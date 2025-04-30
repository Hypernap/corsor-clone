from flask import Flask, render_template, request, jsonify, session, send_from_directory
import os
import json
import shutil
import zipfile
import tempfile
import time
from werkzeug.utils import secure_filename
from terminal_service import terminal_service
from gemini_service import gemini_service

app = Flask(__name__)
app.secret_key = os.urandom(24)

# Project directory - change this to your code directory
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(PROJECT_ROOT, 'uploaded_projects')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50 MB max upload

# Config
ALLOWED_EXTENSIONS = {'txt', 'py', 'js', 'html', 'css', 'json', 'md'}
PROJECTS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'projects.json')

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Helper functions
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_projects():
    if os.path.exists(PROJECTS_FILE):
        with open(PROJECTS_FILE, 'r') as f:
            return json.load(f)
    return []

def save_projects(projects):
    with open(PROJECTS_FILE, 'w') as f:
        json.dump(projects, f)

def get_file_structure(directory):
    file_structure = []
    for item in os.listdir(directory):
        if item.startswith('.'):
            continue
        path = os.path.join(directory, item)
        if os.path.isdir(path):
            file_structure.append({
                'name': item,
                'type': 'directory',
                'children': get_file_structure(path)
            })
        else:
            file_structure.append({
                'name': item,
                'type': 'file'
            })
    return file_structure

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/files')
def list_files():
    files = []
    for root, dirs, filenames in os.walk(PROJECT_ROOT):
        for filename in filenames:
            if filename.startswith('.') or filename == 'app.py' or 'venv' in root or 'uploaded_projects' in root:
                continue
            rel_path = os.path.relpath(os.path.join(root, filename), PROJECT_ROOT)
            files.append(rel_path)
    return jsonify(files)

@app.route('/file')
def get_file():
    file_path = request.args.get('path')
    abs_path = os.path.join(PROJECT_ROOT, file_path)
    
    if not os.path.exists(abs_path):
        return jsonify({"error": "File not found"}), 404
    
    try:
        with open(abs_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        return jsonify({
            "path": file_path,
            "content": content
        })
    except UnicodeDecodeError:
        return jsonify({"error": "Binary file cannot be displayed"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/save', methods=['POST'])
def save_file():
    data = request.get_json()
    file_path = data.get('path')
    content = data.get('content')
    
    abs_path = os.path.join(PROJECT_ROOT, file_path)
    
    # Create directories if they don't exist
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    
    try:
        with open(abs_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/upload', methods=['POST'])
def upload_folder():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    project_name = request.form.get('project_name', 'project')
    
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    # Delete all existing projects (only keep the current one)
    for item in os.listdir(UPLOAD_FOLDER):
        item_path = os.path.join(UPLOAD_FOLDER, item)
        if os.path.isdir(item_path):
            shutil.rmtree(item_path)
    
    # Create a project folder
    project_path = os.path.join(UPLOAD_FOLDER, project_name)
    os.makedirs(project_path)
    
    # Save the uploaded file
    temp_dir = tempfile.mkdtemp()
    zip_path = os.path.join(temp_dir, 'upload.zip')
    file.save(zip_path)
    
    # Extract the zip file
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(project_path)
        success = True
        message = "Project uploaded and extracted successfully"
    except zipfile.BadZipFile:
        success = False
        message = "Invalid zip file"
    except Exception as e:
        success = False
        message = str(e)
    finally:
        # Clean up temp directory
        shutil.rmtree(temp_dir)
    
    return jsonify({
        "success": success,
        "message": message,
        "project_path": os.path.relpath(project_path, PROJECT_ROOT) if success else None
    })

@app.route('/projects')
def list_projects():
    projects = []
    for item in os.listdir(UPLOAD_FOLDER):
        full_path = os.path.join(UPLOAD_FOLDER, item)
        if os.path.isdir(full_path):
            projects.append({
                "name": item,
                "path": os.path.relpath(full_path, PROJECT_ROOT)
            })
    
    return jsonify(projects)

@app.route('/project-files')
def list_project_files():
    project_path = request.args.get('path')
    if not project_path:
        return jsonify({"error": "No project path provided"}), 400
    
    full_path = os.path.join(PROJECT_ROOT, project_path)
    
    if not os.path.exists(full_path) or not os.path.isdir(full_path):
        return jsonify({"error": "Project not found"}), 404
    
    files = []
    for root, dirs, filenames in os.walk(full_path):
        for filename in filenames:
            if filename.startswith('.'):
                continue
            rel_path = os.path.relpath(os.path.join(root, filename), PROJECT_ROOT)
            files.append(rel_path)
    
    return jsonify(files)

@app.route('/api/ai-assistant', methods=['POST'])
def ai_assistant():
    """AI assistant API endpoint using Gemini service"""
    data = request.get_json()
    prompt = data.get('prompt', '')
    file_content = data.get('file_content', '')
    file_path = data.get('file_path', '')
    project_structure = data.get('project_structure', None)
    selected_text = data.get('selected_text', '')
    selected_range = data.get('selected_range', None)
    
    # If file content is provided, use Gemini for code suggestions
    if file_content and file_path:
        try:
            # Generate context for code suggestions
            result = gemini_service.get_code_suggestions(
                file_content, 
                file_path, 
                prompt,
                project_structure,
                selected_text=selected_text,
                selected_range=selected_range
            )
            
            if result['status'] == 'success':
                # If selected text is being edited, we only want to modify that part
                if selected_text and 'suggestion_for_selection' in result:
                    # Return the suggestion specifically for the selected text
                    return jsonify({
                        "response": result.get('explanation', "Here's my suggested edit for the selected code."),
                        "has_code_suggestion": True,
                        "suggestion": result['suggestion'],
                        "diff": result['diff'],
                        "selection_only": True,
                        "selection_replacement": result['suggestion_for_selection'],
                        "selected_range": selected_range,
                        "stats": {
                            "additions": result.get('additions', 0),
                            "deletions": result.get('deletions', 0),
                            "file_name": os.path.basename(file_path)
                        }
                    })
                
                # Count lines changed for full file edits
                diff_lines = result['diff'].strip().split('\n')
                additions = sum(1 for line in diff_lines if line.startswith('+') and not line.startswith('+++'))
                deletions = sum(1 for line in diff_lines if line.startswith('-') and not line.startswith('---'))
                
                # Create a summary message
                file_name = os.path.basename(file_path)
                
                # Get explanation from Gemini
                explanation = result.get('explanation', f"Made {additions} additions and {deletions} deletions to {file_name}.")
                
                return jsonify({
                    "response": explanation,
                    "has_code_suggestion": True,
                    "suggestion": result['suggestion'],
                    "diff": result['diff'],
                    "stats": {
                        "additions": additions,
                        "deletions": deletions,
                        "file_name": file_name
                    }
                })
            else:
                error_message = result.get('error', 'Unknown error')
                print(f"Gemini API error: {error_message}")
                return jsonify({
                    "response": f"I encountered an error while analyzing your code: {error_message}",
                    "has_code_suggestion": False
                })
        except Exception as e:
            error_message = str(e)
            print(f"Exception in AI assistant: {error_message}")
            return jsonify({
                "response": f"Sorry, I encountered an error: {error_message}",
                "has_code_suggestion": False
            })
    else:
        # For general questions without code context, provide a simpler response
        return jsonify({
            "response": "I can help you with your code. To get specific suggestions, please ask about the currently open file.",
            "has_code_suggestion": False
        })

@app.route('/execute-command', methods=['POST'])
def execute_command_placeholder():
    """Placeholder for command execution in terminal"""
    data = request.get_json()
    command = data.get('command', '')
    
    # In a real application, this would execute the command in a controlled environment
    # For now, we'll just simulate a response
    time.sleep(0.5)  # Simulate execution time
    
    return jsonify({
        "output": f"Simulated output for command: {command}",
        "exit_code": 0
    })

@app.route('/api/projects', methods=['GET'])
def api_projects():
    return jsonify(get_projects())

@app.route('/api/projects', methods=['POST'])
def create_project():
    data = request.json
    project_name = data.get('name')
    
    if not project_name:
        return jsonify({'error': 'Project name is required'}), 400
    
    project_dir = os.path.join(UPLOAD_FOLDER, secure_filename(project_name))
    
    if os.path.exists(project_dir):
        return jsonify({'error': 'Project already exists'}), 400
    
    os.makedirs(project_dir)
    
    projects = get_projects()
    projects.append({'name': project_name, 'path': project_dir})
    save_projects(projects)
    
    return jsonify({'message': 'Project created successfully', 'project': {'name': project_name, 'path': project_dir}})

@app.route('/api/projects/<project_name>', methods=['DELETE'])
def delete_project(project_name):
    projects = get_projects()
    for i, project in enumerate(projects):
        if project['name'] == project_name:
            import shutil
            try:
                shutil.rmtree(project['path'])
                projects.pop(i)
                save_projects(projects)
                return jsonify({'message': 'Project deleted successfully'})
            except Exception as e:
                return jsonify({'error': f'Failed to delete project: {str(e)}'}), 500
    
    return jsonify({'error': 'Project not found'}), 404

@app.route('/api/projects/<project_name>/files', methods=['GET'])
def get_project_files(project_name):
    projects = get_projects()
    project = next((p for p in projects if p['name'] == project_name), None)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    file_structure = get_file_structure(project['path'])
    return jsonify(file_structure)

@app.route('/api/projects/<project_name>/files', methods=['POST'])
def create_file(project_name):
    projects = get_projects()
    project = next((p for p in projects if p['name'] == project_name), None)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    data = request.json
    file_path = data.get('path', '')
    file_name = data.get('name', '')
    file_type = data.get('type', 'file')
    
    if not file_name:
        return jsonify({'error': 'File name is required'}), 400
    
    full_path = os.path.join(project['path'], file_path, file_name)
    
    if os.path.exists(full_path):
        return jsonify({'error': 'File already exists'}), 400
    
    try:
        if file_type == 'directory':
            os.makedirs(full_path)
        else:
            with open(full_path, 'w') as f:
                f.write('')
        
        return jsonify({'message': f'{file_type.capitalize()} created successfully'})
    except Exception as e:
        return jsonify({'error': f'Failed to create {file_type}: {str(e)}'}), 500

@app.route('/api/projects/<project_name>/files/<path:file_path>', methods=['GET'])
def get_file_content(project_name, file_path):
    projects = get_projects()
    project = next((p for p in projects if p['name'] == project_name), None)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    full_path = os.path.join(project['path'], file_path)
    
    if not os.path.exists(full_path) or os.path.isdir(full_path):
        return jsonify({'error': 'File not found'}), 404
    
    try:
        with open(full_path, 'r') as f:
            content = f.read()
        
        return jsonify({'content': content})
    except Exception as e:
        return jsonify({'error': f'Failed to read file: {str(e)}'}), 500

@app.route('/api/projects/<project_name>/files/<path:file_path>', methods=['PUT'])
def update_file_content(project_name, file_path):
    projects = get_projects()
    project = next((p for p in projects if p['name'] == project_name), None)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    full_path = os.path.join(project['path'], file_path)
    
    if not os.path.exists(full_path) or os.path.isdir(full_path):
        return jsonify({'error': 'File not found'}), 404
    
    data = request.json
    content = data.get('content', '')
    
    try:
        with open(full_path, 'w') as f:
            f.write(content)
        
        return jsonify({'message': 'File updated successfully'})
    except Exception as e:
        return jsonify({'error': f'Failed to update file: {str(e)}'}), 500

@app.route('/api/projects/<project_name>/files/<path:file_path>', methods=['DELETE'])
def delete_file(project_name, file_path):
    projects = get_projects()
    project = next((p for p in projects if p['name'] == project_name), None)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    full_path = os.path.join(project['path'], file_path)
    
    if not os.path.exists(full_path):
        return jsonify({'error': 'File not found'}), 404
    
    try:
        if os.path.isdir(full_path):
            import shutil
            shutil.rmtree(full_path)
        else:
            os.remove(full_path)
        
        return jsonify({'message': 'File deleted successfully'})
    except Exception as e:
        return jsonify({'error': f'Failed to delete file: {str(e)}'}), 500

# Terminal Routes
@app.route('/api/execute-code', methods=['POST'])
def execute_code():
    """Execute Python code and return the result."""
    try:
        code = request.json.get('code')
        working_dir = request.json.get('working_dir')
        
        if not code:
            return jsonify({"status": "error", "error": "No code provided"})
        
        result = terminal_service.execute_code(code, cwd=working_dir)
        return jsonify(result)
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)})

@app.route('/api/execute-file', methods=['POST'])
def execute_file():
    """Execute a Python file directly from its file path."""
    try:
        file_path = request.json.get('file_path')
        working_dir = request.json.get('working_dir')
        
        if not file_path:
            return jsonify({"status": "error", "error": "No file path provided"})
        
        # Ensure the file path is absolute by joining with PROJECT_ROOT if needed
        if not os.path.isabs(file_path):
            abs_file_path = os.path.join(PROJECT_ROOT, file_path)
        else:
            abs_file_path = file_path
            
        # Log file path information for debugging
        print(f"File execution request - Path: {file_path}")
        print(f"Absolute path: {abs_file_path}")
        print(f"Working dir: {working_dir}")
        print(f"File exists: {os.path.exists(abs_file_path)}")
        
        # Use the absolute file path for execution
        result = terminal_service.execute_file(abs_file_path, cwd=working_dir)
        return jsonify(result)
    except Exception as e:
        print(f"Error in execute_file: {str(e)}")
        return jsonify({"status": "error", "error": str(e)})

@app.route('/api/execute-command', methods=['POST'])
def execute_command():
    """Execute a terminal command and return the result."""
    try:
        command = request.json.get('command')
        working_dir = request.json.get('working_dir')
        
        if not command:
            return jsonify({"status": "error", "error": "No command provided"})
        
        result = terminal_service.execute_command(command, cwd=working_dir)
        return jsonify(result)
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)})

@app.route('/api/terminal-output', methods=['GET'])
def get_terminal_buffer():
    """Get the current terminal output."""
    try:
        buffer = terminal_service.get_buffer()
        return jsonify({"status": "success", "buffer": buffer})
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)})

@app.route('/api/clear-terminal', methods=['POST'])
def clear_terminal_buffer():
    """Clear the terminal buffer."""
    try:
        result = terminal_service.clear_buffer()
        return jsonify(result)
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)})

# Gemini API Routes
@app.route('/api/gemini/code-suggestion', methods=['POST'])
def get_code_suggestion():
    data = request.json
    file_content = data.get('file_content', '')
    file_path = data.get('file_path', '')
    user_prompt = data.get('prompt', '')
    
    if not file_content or not user_prompt:
        return jsonify({'error': 'File content and prompt are required'}), 400
    
    try:
        result = gemini_service.get_code_suggestions(file_content, file_path, user_prompt)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000) 