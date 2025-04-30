#!/usr/bin/env python
# Test file to demonstrate direct file execution

import os
import sys

def main():
    print("Running test_run.py file directly!")
    print(f"Current working directory: {os.getcwd()}")
    print(f"Python executable: {sys.executable}")
    print(f"Python version: {sys.version}")
    print(f"Command line arguments: {sys.argv}")
    
    # Print environment variables
    print("\nEnvironment variables:")
    for key, value in os.environ.items():
        if key.startswith('PYTHON'):
            print(f"  {key}: {value}")
    
    # List files in current directory
    print("\nFiles in current directory:")
    for file in os.listdir('.'):
        print(f"  {file}")

if __name__ == "__main__":
    main() 