# Cursor Clone with Google Gemini Integration

A code editor with integrated AI code suggestions using Google's Gemini API.

## Features

- File management (create, edit, delete files)
- Project management
- Code editing
- Terminal execution
- Google Gemini AI code suggestions

## Setup

1. Clone the repository
2. Create a virtual environment and activate it:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the root directory with your Google Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```
5. Run the application:
   ```
   python app.py
   ```
6. Open your browser and navigate to `http://localhost:5000`

## API Endpoints

### File and Project Management

- `GET /api/projects`: List all projects
- `POST /api/projects`: Create a new project
- `DELETE /api/projects/<project_name>`: Delete a project
- `GET /api/projects/<project_name>/files`: Get project file structure
- `POST /api/projects/<project_name>/files`: Create a new file or directory
- `GET /api/projects/<project_name>/files/<file_path>`: Get file content
- `PUT /api/projects/<project_name>/files/<file_path>`: Update file content
- `DELETE /api/projects/<project_name>/files/<file_path>`: Delete a file

### Terminal Operations

- `POST /api/terminal/execute`: Execute Python code
- `POST /api/terminal/command`: Execute a shell command
- `GET /api/terminal/buffer`: Get terminal output buffer
- `POST /api/terminal/clear`: Clear terminal buffer

### Gemini AI Code Suggestions

- `POST /api/gemini/code-suggestion`: Get AI-powered code suggestions

## Technology Stack

- Backend: Flask (Python)
- AI: Google Gemini API
- Frontend: HTML, CSS, JavaScript

## License

MIT 