import os
import re
import difflib
from typing import Dict, List, Tuple, Optional, Any
from dotenv import load_dotenv
import google.generativeai as genai

class GeminiService:
    def __init__(self):
        """Initialize the Gemini service."""
        self.model = None
        self.setup_api()
    
    def setup_api(self):
        """Set up the Gemini API with the API key from environment variables."""
        try:
            # Load environment variables from .env file
            load_dotenv()
            
            # Try to get API key from config.py first
            api_key = None
            try:
                from config import GOOGLE_API_KEY
                api_key = GOOGLE_API_KEY
                print("Using Google API key from config.py")
            except (ImportError, AttributeError):
                # Fall back to environment variable
                api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
                if api_key:
                    print("Using Google API key from environment variables")
            
            if not api_key or api_key == "your_api_key_here":
                print("WARNING: No valid Google API key found. Please set GOOGLE_API_KEY in config.py or GEMINI_API_KEY in environment variables.")
                return
            
            # Configure the API
            genai.configure(api_key=api_key)
            
            # Initialize the model
            self.init_model()
        except Exception as e:
            print(f"Error setting up Gemini API: {str(e)}")
    
    def init_model(self, model_name: str = None):
        """Initialize the Gemini model.
        
        Args:
            model_name: The name of the model to use. If None, uses the model from config.
        """
        try:
            from config import GEMINI_MODEL
            
            # Use provided model name or fall back to config
            model_name = model_name or GEMINI_MODEL or "gemini-pro"
            
            print(f"Initializing Gemini model: {model_name}")
            
            generation_config = {
                "temperature": 0.2,
                "top_p": 0.95,
                "top_k": 0,
                "max_output_tokens": 8192,
            }
            
            self.model = genai.GenerativeModel(
                model_name=model_name,
                generation_config=generation_config
            )
            
            print("Gemini model initialized successfully")
            
        except ImportError:
            print("Warning: config.py not found, using default model name 'gemini-pro'")
            self.model = genai.GenerativeModel(
                model_name="gemini-pro",
                generation_config={
                    "temperature": 0.2,
                    "top_p": 0.95,
                    "top_k": 0,
                    "max_output_tokens": 8192,
                }
            )
        except Exception as e:
            print(f"Error initializing Gemini model: {str(e)}")
            self.model = None
    
    def get_code_suggestions(self, file_content: str, file_path: str, user_prompt: str, 
                             project_structure=None, selected_text=None, selected_range=None) -> Dict:
        """Get code suggestions using the Gemini model.
        
        Args:
            file_content: The content of the current file.
            file_path: The path of the current file.
            user_prompt: The user's prompt for code suggestions.
            project_structure: Optional structure of the project for context.
            selected_text: Optional selected portion of code to focus on.
            selected_range: Optional range information about the selection.
            
        Returns:
            A dictionary containing:
            - status: "success" or "error"
            - suggestion: The suggested code (if successful)
            - diff: A unified diff between original and suggested code (if successful)
            - explanation: Explanation of the changes (if successful)
            - suggestion_for_selection: Only the modified selected text (if selection provided)
            - error: Error message (if error)
        """
        if not self.model:
            return {
                "status": "error", 
                "error": "Gemini model is not initialized. Please check your API key."
            }
        
        try:
            file_type = self._get_file_type(file_path)
            
            # Format project structure if provided
            project_context = ""
            if project_structure:
                project_context = "\nPROJECT STRUCTURE:\n"
                
                # Add project name
                project_context += f"Project: {project_structure.get('name', 'Unknown')}\n"
                
                # Add files list
                files = project_structure.get('files', [])
                if files:
                    project_context += "Files:\n"
                    for file in files[:50]:  # Limit to 50 files to avoid too long context
                        project_context += f"- {file}\n"
            
            # Determine if we're working with selected text or the whole file
            is_selection_mode = selected_text and len(selected_text.strip()) > 0
            
            if is_selection_mode:
                # Step 1: Get code suggestion for the selected text
                selection_context = f"""
                You are an expert code assistant. You will be provided with a portion of a {file_type} file and a request to modify or enhance it.
                
                Your task is to analyze ONLY the selected code and make the changes requested. 
                
                IMPORTANT: Your response should be ONLY the complete updated code for the selected portion.
                DO NOT include any explanations, comments about what you changed, or markdown formatting.
                
                The selected code is part of a larger file. For context, here's the full file content:
                ```
                {file_content}
                ```
                
                Now, focus ONLY on modifying this SELECTED PORTION of the code:
                ```
                {selected_text}
                ```
                
                REQUEST: {user_prompt}
                
                Remember, return ONLY the modified version of the selected code portion. Maintain the same style and indentation.
                """
                
                # Generate code response for selection
                code_response = self.model.generate_content(selection_context)
                
                # Extract code from response
                suggestion_for_selection = self._extract_code(code_response.text)
                
                # Create a full file suggestion by replacing the selected text with the modified version
                suggestion = self._replace_selection_in_file(file_content, selected_text, suggestion_for_selection)
                
                # Generate diff for the entire file
                diff = self._generate_diff(file_content, suggestion, file_path)
                
                # Step 2: Get explanation for the changes
                explanation_prompt = f"""
                You are a helpful coding assistant. You've just made changes to a selected portion of a {file_type} file.
                
                Original selected code:
                ```
                {selected_text}
                ```
                
                Modified selected code:
                ```
                {suggestion_for_selection}
                ```
                
                Explain the changes you made in response to this request: "{user_prompt}"
                
                Keep your explanation brief (2-3 sentences) and focus on what was changed and why.
                """
                
                try:
                    # Generate explanation
                    explanation_response = self.model.generate_content(explanation_prompt)
                    explanation = explanation_response.text.strip()
                except Exception as e:
                    print(f"Error getting explanation: {e}")
                    explanation = "Selected code was modified based on your request."
                
                return {
                    "status": "success",
                    "suggestion": suggestion,
                    "suggestion_for_selection": suggestion_for_selection,
                    "diff": diff,
                    "explanation": explanation
                }
            else:
                # Process the whole file (existing code)
                code_prompt = f"""
                You are an expert code assistant. You will be provided with the content of a {file_type} file and a request to modify or enhance it.
                
                Your task is to analyze the code and make the changes requested. Your response should be ONLY the complete updated code.
                
                DO NOT include any explanations, comments about what you changed, or markdown formatting.
                ONLY return the complete, updated code that incorporates the requested changes.
                
                Maintain the same coding style, formatting, and comment style as the original code.
                {project_context}
                FILE: {file_path}
                
                CONTENT:
                ```
                {file_content}
                ```
                
                REQUEST: {user_prompt}
                """
                
                # Generate code response
                code_response = self.model.generate_content(code_prompt)
                
                # Extract code from response
                suggestion = self._extract_code(code_response.text)
                
                # Generate diff
                diff = self._generate_diff(file_content, suggestion, file_path)
                
                # Step 2: Get explanation for the changes
                explanation_prompt = f"""
                You are a helpful coding assistant. You've just made changes to a {file_type} file.
                
                Original code:
                ```
                {file_content}
                ```
                
                Modified code:
                ```
                {suggestion}
                ```
                
                Explain the changes you made in response to this request: "{user_prompt}"
                
                Keep your explanation brief (2-3 sentences) and focus on what was changed and why.
                """
                
                try:
                    # Generate explanation
                    explanation_response = self.model.generate_content(explanation_prompt)
                    explanation = explanation_response.text.strip()
                except Exception as e:
                    print(f"Error getting explanation: {e}")
                    explanation = "Code was modified based on your request."
                
                return {
                    "status": "success",
                    "suggestion": suggestion,
                    "diff": diff,
                    "explanation": explanation
                }
            
        except Exception as e:
            return {
                "status": "error",
                "error": f"Error generating code suggestions: {str(e)}"
            }
    
    def _extract_code(self, text: str) -> str:
        """Extract code from the model's response, removing any markdown code blocks.
        
        Args:
            text: The text response from the model.
            
        Returns:
            The extracted code.
        """
        # Check if the text is wrapped in code blocks (```...```)
        code_block_pattern = r"```(?:\w+)?\s*([\s\S]*?)\s*```"
        matches = re.findall(code_block_pattern, text)
        
        if matches:
            # Return the content of the first code block
            return matches[0].strip()
        
        # If no code blocks found, return the whole text
        return text.strip()
    
    def _generate_diff(self, original: str, modified: str, file_path: str) -> str:
        """Generate a unified diff between original and modified code.
        
        Args:
            original: The original code.
            modified: The modified code.
            file_path: The path of the file.
            
        Returns:
            A unified diff string.
        """
        original_lines = original.splitlines(keepends=True)
        modified_lines = modified.splitlines(keepends=True)
        
        diff = difflib.unified_diff(
            original_lines,
            modified_lines,
            fromfile=f"a/{file_path}",
            tofile=f"b/{file_path}",
            n=3  # Context lines
        )
        
        return ''.join(diff)
    
    def _get_file_type(self, file_path: str) -> str:
        """Determine the programming language from the file extension.
        
        Args:
            file_path: The path of the file.
            
        Returns:
            The programming language or file type.
        """
        ext_to_language = {
            '.py': 'Python',
            '.js': 'JavaScript',
            '.ts': 'TypeScript',
            '.jsx': 'React JSX',
            '.tsx': 'React TSX',
            '.html': 'HTML',
            '.css': 'CSS',
            '.java': 'Java',
            '.c': 'C',
            '.cpp': 'C++',
            '.go': 'Go',
            '.rb': 'Ruby',
            '.php': 'PHP',
            '.swift': 'Swift',
            '.rs': 'Rust',
            '.kt': 'Kotlin',
            '.sh': 'Shell',
            '.json': 'JSON',
            '.md': 'Markdown',
            '.sql': 'SQL',
            '.yml': 'YAML',
            '.yaml': 'YAML',
            '.xml': 'XML',
            '.cs': 'C#',
            '.dart': 'Dart',
            '.lua': 'Lua'
        }
        
        _, ext = os.path.splitext(file_path)
        return ext_to_language.get(ext.lower(), 'code')
    
    def _replace_selection_in_file(self, file_content: str, selected_text: str, replacement: str) -> str:
        """Replace the selected text in the file content with the replacement.
        
        Args:
            file_content: The entire file content.
            selected_text: The selected text to replace.
            replacement: The replacement text.
            
        Returns:
            The file content with the selected text replaced.
        """
        # Simple replacement - would be better with range information
        return file_content.replace(selected_text, replacement)

# Create a singleton instance
gemini_service = GeminiService() 