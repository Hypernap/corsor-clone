// Terminal management module
const TerminalManager = {
    // Store terminal state
    buffer: '',
    pollingInterval: null,
    inputHistory: [],
    historyIndex: -1,
    
    // Initialize the terminal
    init() {
        this.setupEventListeners();
        this.startPolling();
    },
    
    // Set up event listeners for the terminal
    setupEventListeners() {
        const terminalInput = document.getElementById('terminal-input');
        if (terminalInput) {
            terminalInput.addEventListener('keydown', this.handleTerminalInput.bind(this));
        }
        
        // Run button for executing current file
        const runButton = document.getElementById('run-current-file');
        if (runButton) {
            runButton.addEventListener('click', this.runCurrentFile.bind(this));
        }
        
        // Clear terminal button
        const clearButton = document.getElementById('clear-terminal');
        if (clearButton) {
            clearButton.addEventListener('click', this.clearTerminal.bind(this));
        }
    },
    
    // Handle terminal input
    handleTerminalInput(event) {
        const input = event.target;
        
        // Handle Enter key to execute command
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            const command = input.value.trim();
            
            if (command) {
                // Add to history
                this.inputHistory.push(command);
                this.historyIndex = this.inputHistory.length;
                
                // Execute the command
                this.executeCommand(command);
                
                // Clear the input
                input.value = '';
            }
        }
        
        // Handle Up/Down keys for command history
        else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (this.historyIndex > 0) {
                this.historyIndex--;
                input.value = this.inputHistory[this.historyIndex];
            }
        }
        else if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (this.historyIndex < this.inputHistory.length - 1) {
                this.historyIndex++;
                input.value = this.inputHistory[this.historyIndex];
            } else {
                this.historyIndex = this.inputHistory.length;
                input.value = '';
            }
        }
    },
    
    // Execute a terminal command
    executeCommand(command) {
        // Display the command in the terminal output
        this.appendToTerminal(`$ ${command}\n`);
        
        // Determine if it's a Python command or shell command
        if (command.startsWith('python ') || command.startsWith('py ')) {
            // Extract the Python script and arguments from the command
            const parts = command.split(' ');
            const scriptPath = parts[1];
            const args = parts.slice(2).join(' ');
            
            if (args.length > 0) {
                // If there are arguments, use the full command
                fetch('/api/execute-command', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        command: command,
                        working_dir: Editor.getCurrentDirectory()
                    })
                })
                .then(response => response.json())
                .catch(error => {
                    console.error('Error executing command:', error);
                    this.appendToTerminal(`Error: ${error.message}\n`);
                });
            } else {
                // No arguments, just run the Python file
                this.runPythonFile(scriptPath);
            }
        } else {
            // Run as a shell command
            fetch('/api/execute-command', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    command: command,
                    working_dir: Editor.getCurrentDirectory()
                })
            })
            .then(response => response.json())
            .catch(error => {
                console.error('Error executing command:', error);
                this.appendToTerminal(`Error: ${error.message}\n`);
            });
        }
    },
    
    // Run the current open file
    runCurrentFile() {
        const currentFile = Editor.getCurrentFile();
        console.log('Current file:', currentFile);
        
        if (!currentFile) {
            this.appendToTerminal('No file is currently open.\n');
            return;
        }
        
        // Check if it's a Python file
        if (currentFile.endsWith('.py')) {
            // Save the file first
            Editor.saveCurrentFile()
                .then(() => {
                    // Make sure we have the full path for the current project
                    const projectDir = Editor.getCurrentDirectory();
                    
                    // Check if the file path is already absolute or needs the project directory prepended
                    let fullPath = currentFile;
                    if (projectDir && !currentFile.startsWith(projectDir)) {
                        // If it's a relative path, prepend the project directory
                        fullPath = projectDir + '/' + currentFile;
                    }
                    
                    console.log('Full file path for execution:', fullPath);
                    // Then execute the file directly
                    this.runPythonFile(fullPath);
                })
                .catch(error => {
                    this.appendToTerminal(`Error saving file: ${error.message}\n`);
                });
        } else {
            this.appendToTerminal('Only Python files can be executed directly.\n');
        }
    },
    
    // Run a specific Python file
    runPythonFile(filePath) {
        console.log('Attempting to run Python file:', filePath, 'working dir:', Editor.getCurrentDirectory());
        
        if (!filePath) {
            this.appendToTerminal('Error: No file path provided\n');
            return;
        }
        
        // Check if the file exists using a quick HEAD request
        fetch('/file?path=' + encodeURIComponent(filePath), { method: 'HEAD' })
            .then(response => {
                if (!response.ok) {
                    this.appendToTerminal(`Error: File not found at path: ${filePath}\n`);
                    return;
                }
                
                // File exists, proceed with execution
                fetch('/api/execute-file', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        file_path: filePath,
                        working_dir: Editor.getCurrentDirectory()
                    })
                })
                .then(response => response.json())
                .catch(error => {
                    console.error('Error executing file:', error);
                    this.appendToTerminal(`Error executing file: ${error.message}\n`);
                });
            })
            .catch(error => {
                console.error('Error checking file existence:', error);
                this.appendToTerminal(`Error checking file: ${error.message}\n`);
            });
    },
    
    // Execute Python code
    executeCode(code) {
        fetch('/api/execute-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: code,
                working_dir: Editor.getCurrentDirectory()
            })
        })
        .then(response => response.json())
        .catch(error => {
            console.error('Error executing code:', error);
            this.appendToTerminal(`Error: ${error.message}\n`);
        });
    },
    
    // Clear the terminal
    clearTerminal() {
        fetch('/api/clear-terminal', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        })
        .then(response => response.json())
        .then(() => {
            const terminalOutput = document.getElementById('terminal-output');
            if (terminalOutput) {
                terminalOutput.innerHTML = '';
            }
            this.buffer = '';
        })
        .catch(error => {
            console.error('Error clearing terminal:', error);
        });
    },
    
    // Start polling for terminal updates
    startPolling() {
        // Stop any existing polling
        this.stopPolling();
        
        // Start new polling interval
        this.pollingInterval = setInterval(() => {
            this.updateTerminal();
        }, 500); // Poll every 500ms
    },
    
    // Stop polling
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    },
    
    // Update the terminal output
    updateTerminal() {
        fetch('/api/terminal-output')
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success' && data.buffer !== this.buffer) {
                    const terminalOutput = document.getElementById('terminal-output');
                    if (terminalOutput) {
                        // Update only if buffer has changed
                        this.buffer = data.buffer;
                        terminalOutput.innerHTML = this.formatTerminalOutput(this.buffer);
                        terminalOutput.scrollTop = terminalOutput.scrollHeight;
                    }
                }
            })
            .catch(error => {
                console.error('Error updating terminal:', error);
            });
    },
    
    // Format terminal output with ANSI color codes
    formatTerminalOutput(text) {
        // Convert ANSI color codes to HTML
        // Basic implementation - can be expanded for more codes
        return text
            .replace(/\033\[31m/g, '<span class="text-red">')  // Red for stderr
            .replace(/\033\[0m/g, '</span>')
            .replace(/\n/g, '<br>')
            .replace(/ /g, '&nbsp;');
    },
    
    // Append text to the terminal display (without sending to server)
    appendToTerminal(text) {
        const terminalOutput = document.getElementById('terminal-output');
        if (terminalOutput) {
            const formattedText = this.formatTerminalOutput(text);
            terminalOutput.innerHTML += formattedText;
            terminalOutput.scrollTop = terminalOutput.scrollHeight;
        }
    }
};

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    TerminalManager.init();
}); 