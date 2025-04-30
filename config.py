import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Google Gemini API key
GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY")

# Configure the model to use
GEMINI_MODEL = "gemini-2.0-flash"

# Terminal settings
MAX_TERMINAL_OUTPUT = 10000  # Maximum number of characters to store in terminal history 