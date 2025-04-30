import os
import subprocess
import sys
import threading
import queue
import time
import platform
import tempfile
from io import StringIO

class TerminalService:
    def __init__(self):
        self.buffer = ""  # Single buffer for simplicity
        self.buffer_lock = threading.Lock()
        self.running_process = None
        self.process_lock = threading.Lock()
        self.output_queue = queue.Queue()
        self.max_buffer_size = 100000  # Maximum size of terminal buffer in characters
    
    def execute_code(self, code, cwd=None):
        """
        Execute Python code in a separate process
        
        Args:
            code (str): Python code to execute
            cwd (str, optional): Working directory for execution
            
        Returns:
            dict: Status of execution
        """
        # Create a temporary file to hold the code
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as temp_file:
            temp_file_path = temp_file.name
            temp_file.write(code)
        
        try:
            # Execute the temporary Python file
            command = [sys.executable, temp_file_path]
            return self._execute_command(command, cwd)
        finally:
            # Clean up the temporary file
            try:
                os.unlink(temp_file_path)
            except Exception as e:
                print(f"Error removing temporary file: {str(e)}")
    
    def execute_file(self, file_path, cwd=None):
        """
        Execute a Python file directly from its path
        
        Args:
            file_path (str): Path to the Python file to execute
            cwd (str, optional): Working directory for execution. If None, use the directory of the file
            
        Returns:
            dict: Status of execution
        """
        if not os.path.exists(file_path):
            error_msg = f"File not found: {file_path}"
            self._append_to_buffer(error_msg)
            return {"status": "error", "error": error_msg}
            
        # If working directory is not specified, use the directory containing the file
        if cwd is None:
            cwd = os.path.dirname(file_path)
            
        # Execute the Python file
        command = [sys.executable, file_path]
        return self._execute_command(command, cwd)
    
    def execute_command(self, command, cwd=None):
        """
        Execute a shell command
        
        Args:
            command (str or list): Command to execute
            cwd (str, optional): Working directory for execution
            
        Returns:
            dict: Status of execution
        """
        # Choose the shell based on the platform
        shell = True if platform.system() == "Windows" or isinstance(command, str) else False
        
        return self._execute_command(command, cwd, shell=shell)
    
    def _execute_command(self, command, cwd=None, shell=False):
        """
        Internal method to execute a command
        
        Args:
            command: Command to execute (list or string)
            cwd: Working directory
            shell: Whether to use shell
            
        Returns:
            dict: Status of execution
        """
        with self.process_lock:
            # Kill any running process
            if self.running_process:
                try:
                    self.running_process.kill()
                except:
                    pass
            
            try:
                # Start the process
                self.running_process = subprocess.Popen(
                    command,
                    cwd=cwd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    shell=shell
                )
                
                # Start threads to read stdout and stderr
                stdout_thread = threading.Thread(
                    target=self._read_stream, 
                    args=(self.running_process.stdout, "stdout")
                )
                stderr_thread = threading.Thread(
                    target=self._read_stream, 
                    args=(self.running_process.stderr, "stderr")
                )
                
                stdout_thread.daemon = True
                stderr_thread.daemon = True
                stdout_thread.start()
                stderr_thread.start()
                
                # Start a thread to process the output queue
                process_thread = threading.Thread(target=self._process_output)
                process_thread.daemon = True
                process_thread.start()
                
                return {"status": "started", "pid": self.running_process.pid}
            
            except Exception as e:
                error_msg = f"Error executing command: {str(e)}"
                self._append_to_buffer(error_msg)
                return {"status": "error", "error": error_msg}
    
    def _read_stream(self, stream, stream_name):
        """Read from stdout or stderr streams and put into the output queue"""
        for line in stream:
            self.output_queue.put((stream_name, line))
        stream.close()
    
    def _process_output(self):
        """Process the output queue and append to buffer"""
        while True:
            try:
                # Check if process has exited
                with self.process_lock:
                    if self.running_process and self.running_process.poll() is not None:
                        # Process terminated, check if output queue is empty
                        if self.output_queue.empty():
                            exit_code = self.running_process.poll()
                            self._append_to_buffer(f"\nProcess exited with code {exit_code}\n")
                            self.running_process = None
                            break
                
                # Get output from queue with timeout
                try:
                    stream_name, line = self.output_queue.get(timeout=0.1)
                    # Add appropriate coloring for stderr
                    if stream_name == "stderr":
                        formatted_line = f"\033[31m{line}\033[0m"  # Red text for stderr
                    else:
                        formatted_line = line
                    
                    self._append_to_buffer(formatted_line)
                    self.output_queue.task_done()
                except queue.Empty:
                    # No output available, sleep briefly
                    time.sleep(0.1)
            
            except Exception as e:
                self._append_to_buffer(f"\nError in output processing: {str(e)}\n")
                break
    
    def _append_to_buffer(self, text):
        """Append text to the terminal buffer with size limitation"""
        with self.buffer_lock:
            self.buffer += text
            # Trim buffer if it exceeds max size
            if len(self.buffer) > self.max_buffer_size:
                self.buffer = self.buffer[-self.max_buffer_size:]
    
    def get_buffer(self):
        """Get the current terminal buffer"""
        with self.buffer_lock:
            return self.buffer
    
    def clear_buffer(self):
        """Clear the terminal buffer"""
        with self.buffer_lock:
            self.buffer = ""
        return {"status": "cleared"}
    
    def kill_process(self):
        """Kill the currently running process"""
        with self.process_lock:
            if self.running_process:
                try:
                    self.running_process.kill()
                    self._append_to_buffer("\nProcess terminated by user\n")
                    return {"status": "killed"}
                except Exception as e:
                    return {"status": "error", "error": str(e)}
            else:
                return {"status": "no_process"}

# Create a singleton instance
terminal_service = TerminalService() 