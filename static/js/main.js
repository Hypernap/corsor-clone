document.addEventListener('DOMContentLoaded', function() {
    // Initialize Ace editor
    const editor = ace.edit("editor");
    editor.setTheme("ace/theme/monokai");
    editor.session.setMode("ace/mode/python");
    editor.setOptions({
        enableBasicAutocompletion: true,
        enableSnippets: true,
        enableLiveAutocompletion: true,
        fontSize: "14px"
    });
    
    // Track changes for unsaved indicator
    editor.on("change", function() {
        if (currentFile && !currentFileTab.textContent.includes(' *')) {
            currentFileTab.textContent += ' *';
        }
    });

    // Initialize the Editor object for terminal.js to use
    window.Editor = {
        currentProject: null,
        
        getCurrentFile: function() {
            return currentFile;
        },
        
        getCurrentDirectory: function() {
            return currentProject;
        },
        
        getCode: function() {
            return editor.getValue();
        },
        
        getSelectedText: function() {
            const selection = editor.getSession().getSelection();
            return editor.getSession().getTextRange(selection.getRange());
        },
        
        saveCurrentFile: function() {
            return new Promise((resolve, reject) => {
                if (!currentFile) {
                    reject(new Error('No file selected'));
                    return;
                }
                
                saveFile()
                    .then(() => resolve())
                    .catch(error => reject(error));
            });
        }
    };

    let currentFile = null;
    let currentProject = null;
    
    // DOM elements
    const saveBtn = document.getElementById('save-btn');
    const runBtn = document.getElementById('run-btn');
    const runCurrentFileBtn = document.getElementById('run-current-file');
    const terminalInput = document.getElementById('terminal-input');
    const currentFileTab = document.getElementById('current-file-tab');
    const fileTree = document.getElementById('file-tree');
    const uploadBtn = document.getElementById('upload-btn');
    const uploadForm = document.getElementById('upload-form');
    const projectUploadForm = document.getElementById('project-upload-form');
    const cancelUploadBtn = document.getElementById('cancel-upload');
    const projectsList = document.getElementById('projects-list');
    const clearTerminalBtn = document.getElementById('clear-terminal');
    const sendPromptBtn = document.getElementById('send-prompt');
    const chatPrompt = document.getElementById('chat-prompt');
    const chatMessages = document.getElementById('chat-messages');
    const codeDiff = document.getElementById('code-diff');
    const diffContent = document.getElementById('diff-content');
    const acceptDiffBtn = document.getElementById('accept-diff');
    const rejectDiffBtn = document.getElementById('reject-diff');

    // Terminal functionality
    clearTerminalBtn.addEventListener('click', function() {
        if (TerminalManager && typeof TerminalManager.clearTerminal === 'function') {
            TerminalManager.clearTerminal();
        }
    });
    
    // Handle terminal input
    terminalInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            const command = terminalInput.value;
            
            if (command.trim()) {
                // Display the command in the terminal
                if (TerminalManager && typeof TerminalManager.executeCommand === 'function') {
                    TerminalManager.executeCommand(command);
                }
                
                // Clear the input
                terminalInput.value = '';
            }
        }
    });
    
    // Run button functionality
    runBtn.addEventListener('click', function() {
        if (TerminalManager && typeof TerminalManager.runCurrentFile === 'function') {
            TerminalManager.runCurrentFile();
        }
    });
    
    runCurrentFileBtn.addEventListener('click', function() {
        if (TerminalManager && typeof TerminalManager.runCurrentFile === 'function') {
            TerminalManager.runCurrentFile();
        }
    });
    
    // Function to run the current code
    function runCurrentCode() {
        if (!currentFile) {
            if (TerminalManager && typeof TerminalManager.writeln === 'function') {
                TerminalManager.writeln('Error: No file selected to run');
            }
            return;
        }
        
        // Get the content and file extension
        const content = editor.getValue();
        const fileExt = currentFile.split('.').pop().toLowerCase();
        
        let command = '';
        
        // Determine how to run the file based on extension
        if (fileExt === 'py') {
            // For Python files, we'll execute the code directly
            executeCode(content);
        } else if (fileExt === 'js') {
            if (TerminalManager && typeof TerminalManager.writeln === 'function') {
                TerminalManager.writeln('Running JavaScript file is not supported in this demo.');
            }
        } else if (fileExt === 'html') {
            if (TerminalManager && typeof TerminalManager.writeln === 'function') {
                TerminalManager.writeln('Opening HTML files is not supported in this demo.');
            }
        } else {
            if (TerminalManager && typeof TerminalManager.writeln === 'function') {
                TerminalManager.writeln(`Unsupported file type: ${fileExt}`);
            }
        }
    }
    
    // Function to execute a command
    function executeCommand(command) {
        // Show a loading indicator
        if (TerminalManager && typeof TerminalManager.writeln === 'function') {
            TerminalManager.writeln('Executing command...');
        }
        
        // Call the API to execute the command
        fetch('/api/terminal/command', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                command: command,
                working_dir: currentProject || null
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'error') {
                if (TerminalManager && typeof TerminalManager.writeln === 'function') {
                    TerminalManager.writeln(`Error: ${data.error}`);
                }
            } else {
                // The buffer will be updated automatically if using server-sent events
                // or we can fetch it manually
                getTerminalBuffer();
            }
        })
        .catch(error => {
            if (TerminalManager && typeof TerminalManager.writeln === 'function') {
                TerminalManager.writeln(`Error executing command: ${error.message}`);
            }
        });
    }
    
    // Function to execute code
    function executeCode(code) {
        // Show a loading indicator
        if (TerminalManager && typeof TerminalManager.writeln === 'function') {
            TerminalManager.writeln('Executing code...');
        }
        
        // Save the file if it's not saved
        if (currentFileTab.textContent.includes('*')) {
            saveFile();
        }
        
        // Call the API to execute the code
        fetch('/api/terminal/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: code,
                working_dir: currentProject || null
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'error') {
                if (TerminalManager && typeof TerminalManager.writeln === 'function') {
                    TerminalManager.writeln(`Error: ${data.error}`);
                }
            } else {
                // The buffer will be updated automatically if using server-sent events
                // or we can fetch it manually
                getTerminalBuffer();
            }
        })
        .catch(error => {
            if (TerminalManager && typeof TerminalManager.writeln === 'function') {
                TerminalManager.writeln(`Error executing code: ${error.message}`);
            }
        });
    }
    
    // Function to get the terminal buffer
    function getTerminalBuffer() {
        fetch('/api/terminal/buffer')
            .then(response => response.json())
            .then(data => {
                // Clear terminal and write the new buffer
                if (TerminalManager && typeof TerminalManager.clear === 'function') {
                    TerminalManager.clear();
                }
                if (TerminalManager && typeof TerminalManager.write === 'function') {
                    TerminalManager.write(data.buffer);
                }
            })
            .catch(error => {
                if (TerminalManager && typeof TerminalManager.writeln === 'function') {
                    TerminalManager.writeln(`Error getting terminal output: ${error.message}`);
                }
            });
    }

    // Chat/LLM functionality
    sendPromptBtn.addEventListener('click', function() {
        const prompt = chatPrompt.value.trim();
        if (!prompt) return;

        // Add user message to chat
        addChatMessage('user', prompt);
        chatPrompt.value = '';

        // Call the AI assistant API with the current file content
        getAIResponse(prompt);
    });

    function getAIResponse(prompt) {
        // Show loading indicator
        addChatMessage('ai', 'Thinking...');
        
        // Save the original code
        const originalCode = editor.getValue();
        let originalFilePath = currentFile;
        
        // Check if there's a text selection in the editor
        const selectedText = Editor.getSelectedText();
        let selectedRange = null;
        
        if (selectedText) {
            // Get the selection range
            const selection = editor.getSelection();
            const range = selection.getRange();
            selectedRange = {
                startRow: range.start.row,
                startCol: range.start.column,
                endRow: range.end.row,
                endCol: range.end.column
            };
            console.log('Selection range:', selectedRange);
        }
        
        // Prepare payload - include current file if one is open
        const payload = {
            prompt: prompt
        };
        
        if (currentFile) {
            payload.file_path = currentFile;
            payload.file_content = originalCode;
            
            // Add selected text if available
            if (selectedText) {
                payload.selected_text = selectedText;
                payload.selected_range = selectedRange;
            }
            
            // Add project structure
            if (currentProject) {
                payload.project_structure = getProjectStructure();
            }
        }
        
        // Call the AI assistant API
        fetch('/api/ai-assistant', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Remove the "Thinking..." message
            chatMessages.removeChild(chatMessages.lastChild);
            
            // Add the AI response
            const responseWithSummary = data.has_code_suggestion ? 
                `<div class="ai-response-header">${data.response}</div>` : 
                data.response;
                
            addChatMessage('ai', responseWithSummary, data.has_code_suggestion);
            
            // If there's a code suggestion, show the diff and update editor
            if (data.has_code_suggestion && data.diff) {
                // Store the original file info
                editor.originalCode = originalCode;
                editor.originalFile = originalFilePath;
                
                // Store the suggestion
                editor.suggestedCode = data.suggestion;
                
                // Handle selection-only mode
                if (data.selection_only && data.selection_replacement) {
                    editor.selectionReplacement = data.selection_replacement;
                    editor.selectedRange = data.selected_range;
                }
                
                // Create editor toggle buttons
                const statsHtml = data.stats ? 
                    `<div class="diff-stats">
                        <span class="diff-file">${data.stats.file_name}</span>
                        <span class="diff-additions">+${data.stats.additions}</span>
                        <span class="diff-deletions">-${data.stats.deletions}</span>
                    </div>` : '';
                
                // Prepare enhanced diff display
                const diffHeader = `
                    <div class="diff-header">
                        ${statsHtml}
                        <div class="editor-toggle">
                            <button id="show-original" class="btn-small">Original</button>
                            <button id="show-suggested" class="btn-small btn-primary">Suggested</button>
                        </div>
                    </div>`;
                
                const formattedDiff = formatDiff(data.diff);
                diffContent.innerHTML = diffHeader + formattedDiff;
                codeDiff.classList.remove('hidden');
                
                // Show suggested code in editor
                editor.setValue(data.suggestion, -1);
                
                // Highlight the changes in the editor
                highlightEditorChanges(originalCode, data.suggestion);
                
                // Add event listeners for toggle buttons
                document.getElementById('show-original').addEventListener('click', function() {
                    editor.setValue(editor.originalCode, -1);
                    clearEditorMarkers(); // Clear highlights when showing original
                    this.classList.add('btn-primary');
                    document.getElementById('show-suggested').classList.remove('btn-primary');
                });
                
                document.getElementById('show-suggested').addEventListener('click', function() {
                    editor.setValue(editor.suggestedCode, -1);
                    highlightEditorChanges(editor.originalCode, editor.suggestedCode);
                    this.classList.add('btn-primary');
                    document.getElementById('show-original').classList.remove('btn-primary');
                });
                
                // Store the suggestion for later use
                codeDiff.dataset.suggestion = data.suggestion;
            }
        })
        .catch(error => {
            // Remove the "Thinking..." message
            chatMessages.removeChild(chatMessages.lastChild);
            
            // Simplify error message if it's too long
            let errorMessage = error.message;
            if (errorMessage.length > 150) {
                errorMessage = errorMessage.substring(0, 150) + '...';
            }
            
            // Show error message
            addChatMessage('ai', `Sorry, I encountered an error: ${errorMessage}. Please try again later.`);
            console.error('Error calling AI assistant:', error);
            
            // Log the full error to console
            console.error('Full error:', error);
        });
    }
    
    // Get the current project structure
    function getProjectStructure() {
        // This is a simplified representation
        // In a real implementation, you would want to recursively get the full structure
        return {
            name: currentProject,
            files: currentProject ? getFilesInCurrentProject() : []
        };
    }
    
    // Get all files in the current project
    function getFilesInCurrentProject() {
        const files = [];
        
        // Function to recursively collect all file paths from a container
        function collectFiles(container) {
            // Get all file items within this container
            const fileItems = container.querySelectorAll(':scope > .file-item');
            
            fileItems.forEach(item => {
                const path = item.getAttribute('data-path');
                if (path) {
                    files.push(path);
                }
            });
            
            // Process subfolders
            const folderContainers = container.querySelectorAll(':scope > .folder-children');
            folderContainers.forEach(folderContainer => {
                collectFiles(folderContainer);
            });
        }
        
        // Start with the main file tree container
        const fileTreeContainer = document.getElementById('file-tree');
        collectFiles(fileTreeContainer);
        
        return files;
    }
    
    function addChatMessage(sender, text, isHtml = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}-message`;
        
        const senderSpan = document.createElement('span');
        senderSpan.className = 'message-sender';
        senderSpan.textContent = sender === 'user' ? 'You: ' : 'AI: ';
        
        const contentSpan = document.createElement('span');
        contentSpan.className = 'message-content';
        
        // If HTML content is provided, set innerHTML instead of textContent
        if (isHtml) {
            contentSpan.innerHTML = text;
        } else {
            contentSpan.textContent = text;
        }
        
        messageDiv.appendChild(senderSpan);
        messageDiv.appendChild(contentSpan);
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Format the diff with syntax highlighting
    function formatDiff(diff) {
        return diff.split('\n').map(line => {
            if (line.startsWith('+')) {
                return `<div class="diff-line diff-add">${escapeHtml(line)}</div>`;
            } else if (line.startsWith('-')) {
                return `<div class="diff-line diff-remove">${escapeHtml(line)}</div>`;
            } else if (line.startsWith('@')) {
                return `<div class="diff-line diff-info">${escapeHtml(line)}</div>`;
            } else {
                return `<div class="diff-line">${escapeHtml(line)}</div>`;
            }
        }).join('');
    }
    
    // Helper to escape HTML
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    
    // Diff acceptance/rejection
    acceptDiffBtn.addEventListener('click', function() {
        if (editor.suggestedCode && currentFile) {
            // Check if this is a selection-only edit
            if (editor.selectionReplacement && editor.selectedRange) {
                // Get the current selection range
                const range = new ace.Range(
                    editor.selectedRange.startRow,
                    editor.selectedRange.startCol,
                    editor.selectedRange.endRow,
                    editor.selectedRange.endCol
                );
                
                // Replace just the selected text with the suggested replacement
                editor.getSession().replace(range, editor.selectionReplacement);
                
                addChatMessage('ai', 'Selection changes applied! Click Save to make them permanent.');
                codeDiff.classList.add('hidden');
                
                // Update editor status to indicate unsaved changes
                currentFileTab.textContent = currentFileTab.textContent.replace(' *', '') + ' *';
            } else {
                // The suggested code is already in the editor for the whole file
                // Just add confirmation and prepare for saving
                addChatMessage('ai', 'Changes applied! Click Save to make them permanent.');
                codeDiff.classList.add('hidden');
                
                // Update editor status to indicate unsaved changes
                currentFileTab.textContent = currentFileTab.textContent.replace(' *', '') + ' *';
            }
        } else {
            addChatMessage('ai', 'Error: Could not apply changes.');
        }
    });

    rejectDiffBtn.addEventListener('click', function() {
        // Check if this is a selection-only edit
        if (editor.selectionReplacement && editor.selectedRange) {
            // Just restore the original code without changing selection
            editor.setValue(editor.originalCode, -1);
            
            // Try to reselect the original text
            const range = new ace.Range(
                editor.selectedRange.startRow,
                editor.selectedRange.startCol,
                editor.selectedRange.endRow,
                editor.selectedRange.endCol
            );
            editor.getSelection().setSelectionRange(range);
            
            addChatMessage('ai', 'Selection changes rejected. The original code has been restored.');
            codeDiff.classList.add('hidden');
        } else {
            // Restore the original code
            if (editor.originalCode && currentFile) {
                editor.setValue(editor.originalCode, -1);
            }
            
            addChatMessage('ai', 'Changes rejected. The original code has been restored.');
            codeDiff.classList.add('hidden');
        }
    });

    // Upload project UI handlers
    uploadBtn.addEventListener('click', function() {
        uploadForm.classList.toggle('hidden');
    });

    cancelUploadBtn.addEventListener('click', function() {
        uploadForm.classList.add('hidden');
        projectUploadForm.reset();
    });

    projectUploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const projectName = document.getElementById('project-name').value;
        const projectFile = document.getElementById('project-file').files[0];
        
        if (!projectFile) {
            alert('Please select a ZIP file');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', projectFile);
        formData.append('project_name', projectName);
        
        // Show loading indicator
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';
        
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (TerminalManager && typeof TerminalManager.writeln === 'function') {
                    TerminalManager.writeln(`Project "${projectName}" uploaded successfully.`);
                }
                uploadForm.classList.add('hidden');
                projectUploadForm.reset();
                
                // Clear projects list and add only the current project
                projectsList.innerHTML = '';
                currentProject = data.project_path;
                
                // Add the new project to the list
                const projectItem = createProjectItem({
                    name: projectName,
                    path: data.project_path
                });
                projectsList.appendChild(projectItem);
                
                // Set as active and load files
                projectItem.classList.add('active');
                loadProjectFiles(data.project_path);
            } else {
                if (TerminalManager && typeof TerminalManager.writeln === 'function') {
                    TerminalManager.writeln(`Error: ${data.message}`);
                }
                alert('Error: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error uploading project:', error);
            if (TerminalManager && typeof TerminalManager.writeln === 'function') {
                TerminalManager.writeln('Error uploading project. Please try again.');
            }
            alert('Error uploading project. Please try again.');
        })
        .finally(() => {
            // Reset button
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload Project';
        });
    });

    // Create project item element
    function createProjectItem(project) {
        const projectItem = document.createElement('div');
        projectItem.className = 'project-item';
        projectItem.textContent = project.name;
        projectItem.addEventListener('click', () => {
            // Remove active class from all projects
            document.querySelectorAll('.project-item').forEach(item => {
                item.classList.remove('active');
            });
            
            // Add active class to selected project
            projectItem.classList.add('active');
            
            currentProject = project.path;
            loadProjectFiles(project.path);
            if (TerminalManager && typeof TerminalManager.writeln === 'function') {
                TerminalManager.writeln(`Switched to project: ${project.name}`);
            }
        });
        return projectItem;
    }

    // Load projects list - modified to just load available projects without remembering old ones
    function loadProjects() {
        fetch('/projects')
            .then(response => response.json())
            .then(projects => {
                projectsList.innerHTML = '';
                if (projects.length === 0) {
                    const noProjects = document.createElement('div');
                    noProjects.className = 'empty-message';
                    noProjects.textContent = 'No projects found';
                    projectsList.appendChild(noProjects);
                    return;
                }
                
                // We only keep the last uploaded project
                const latestProject = projects[projects.length - 1];
                const projectItem = createProjectItem(latestProject);
                projectsList.appendChild(projectItem);
                
                // Automatically set as active and load files
                projectItem.classList.add('active');
                currentProject = latestProject.path;
                loadProjectFiles(latestProject.path);
            })
            .catch(error => console.error('Error loading projects:', error));
    }

    // Load project files
    function loadProjectFiles(projectPath) {
        fetch(`/project-files?path=${encodeURIComponent(projectPath)}`)
            .then(response => response.json())
            .then(files => {
                // Clear current file tree
                fileTree.innerHTML = '';
                
                if (files.length === 0) {
                    fileTree.innerHTML = '<div class="empty-message">No files in this project</div>';
                    return;
                }
                
                // Create a file structure
                const fileStructure = createFileStructure(files, projectPath);
                
                // Render file tree
                renderFileTree(fileStructure, fileTree);
            })
            .catch(error => {
                console.error('Error loading project files:', error);
                if (TerminalManager && typeof TerminalManager.writeln === 'function') {
                    TerminalManager.writeln(`Error loading project files: ${error.message}`);
                }
            });
    }

    // Create file structure from flat file list
    function createFileStructure(files, basePath) {
        const root = {
            name: 'root',
            type: 'folder',
            path: basePath,
            children: {}
        };

        files.forEach(file => {
            // Remove the base path to get the relative path
            const relativePath = file.replace(basePath + '/', '');
            const parts = relativePath.split('/');
            
            let currentLevel = root.children;
            
            // Process all path parts except the last one (which is the file)
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                if (!currentLevel[part]) {
                    currentLevel[part] = {
                        name: part,
                        type: 'folder',
                        path: basePath + '/' + parts.slice(0, i + 1).join('/'),
                        children: {}
                    };
                }
                currentLevel = currentLevel[part].children;
            }
            
            // Process the file (last part)
            const fileName = parts[parts.length - 1];
            currentLevel[fileName] = {
                name: fileName,
                type: 'file',
                path: file,
                children: null
            };
        });
        
        return root;
    }

    // Render file tree recursively
    function renderFileTree(node, parentElement, level = 0) {
        if (node.type === 'folder' && node.name !== 'root') {
            const folderElement = document.createElement('div');
            folderElement.className = 'folder-item';
            folderElement.setAttribute('data-path', node.path);
            
            const folderIcon = document.createElement('span');
            folderIcon.className = 'folder-icon';
            folderIcon.textContent = '📁';
            
            const folderName = document.createElement('span');
            folderName.textContent = node.name;
            
            folderElement.appendChild(folderIcon);
            folderElement.appendChild(folderName);
            parentElement.appendChild(folderElement);
            
            // Create container for children
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'folder-children';
            parentElement.appendChild(childrenContainer);
            
            // Toggle folder visibility on click
            folderElement.addEventListener('click', function(event) {
                // Stop event from bubbling to parent folders
                event.stopPropagation();
                
                // Toggle expanded class
                folderElement.classList.toggle('expanded');
                
                // Toggle visibility of children
                childrenContainer.classList.toggle('visible');
                
                // Update folder icon
                folderIcon.textContent = folderElement.classList.contains('expanded') ? '📂' : '📁';
            });
            
            // Render children
            Object.values(node.children).sort((a, b) => {
                // Sort folders first, then files
                if (a.type === b.type) {
                    return a.name.localeCompare(b.name);
                }
                return a.type === 'folder' ? -1 : 1;
            }).forEach(child => {
                renderFileTree(child, childrenContainer, level + 1);
            });
        } else if (node.type === 'file') {
            const fileElement = document.createElement('div');
            fileElement.className = 'file-item';
            fileElement.setAttribute('data-path', node.path);
            
            // Add icon based on file extension
            const fileIcon = document.createElement('span');
            fileIcon.className = 'file-icon';
            const extension = node.name.split('.').pop().toLowerCase();
            
            let iconText = '📄';
            if (['js', 'ts'].includes(extension)) iconText = '🟨';
            else if (['py'].includes(extension)) iconText = '🐍';
            else if (['html', 'htm'].includes(extension)) iconText = '🌐';
            else if (['css'].includes(extension)) iconText = '🎨';
            else if (['json'].includes(extension)) iconText = '📋';
            else if (['md'].includes(extension)) iconText = '📝';
            
            fileIcon.textContent = iconText;
            
            const fileName = document.createElement('span');
            fileName.textContent = node.name;
            
            fileElement.appendChild(fileIcon);
            fileElement.appendChild(fileName);
            fileElement.addEventListener('click', function(event) {
                event.stopPropagation();
                
                // Remove active class from all files
                document.querySelectorAll('.file-item').forEach(item => {
                    item.classList.remove('active');
                });
                
                // Add active class to selected file
                fileElement.classList.add('active');
                
                loadFile(node.path);
            });
            parentElement.appendChild(fileElement);
        } else if (node.type === 'folder' && node.name === 'root') {
            // For root, just render its children
            Object.values(node.children).sort((a, b) => {
                // Sort folders first, then files
                if (a.type === b.type) {
                    return a.name.localeCompare(b.name);
                }
                return a.type === 'folder' ? -1 : 1;
            }).forEach(child => {
                renderFileTree(child, parentElement, level);
            });
        }
    }

    // Load a file into the editor
    function loadFile(filePath) {
        fetch(`/file?path=${encodeURIComponent(filePath)}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert(data.error);
                    if (TerminalManager && typeof TerminalManager.writeln === 'function') {
                        TerminalManager.writeln(`Error: ${data.error}`);
                    }
                    return;
                }
                
                editor.setValue(data.content, -1); // -1 moves cursor to start
                
                // Set file mode based on extension
                const fileExtension = filePath.split('.').pop();
                setEditorMode(fileExtension);
                
                currentFile = filePath;
                // Display filename in tab
                const fileName = filePath.split('/').pop();
                currentFileTab.textContent = fileName;
                
                // Update AI assistant file indicator
                const fileIndicator = document.querySelector('#ai-context-file .file-indicator-name');
                if (fileIndicator) {
                    fileIndicator.textContent = fileName;
                }
                
                if (TerminalManager && typeof TerminalManager.writeln === 'function') {
                    TerminalManager.writeln(`Opened file: ${fileName}`);
                }
            })
            .catch(error => {
                console.error('Error loading file:', error);
                if (TerminalManager && typeof TerminalManager.writeln === 'function') {
                    TerminalManager.writeln(`Error loading file: ${error.message}`);
                }
            });
    }

    // Save current file
    function saveFile() {
        if (!currentFile) {
            alert('No file selected');
            if (TerminalManager && typeof TerminalManager.writeln === 'function') {
                TerminalManager.writeln('Error: No file selected to save');
            }
            return;
        }

        const content = editor.getValue();
        
        fetch('/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: currentFile,
                content: content
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Remove the unsaved indicator
                currentFileTab.textContent = currentFileTab.textContent.replace(' *', '');
                
                if (TerminalManager && typeof TerminalManager.writeln === 'function') {
                    TerminalManager.writeln(`File saved: ${currentFile.split('/').pop()}`);
                }
            } else {
                if (TerminalManager && typeof TerminalManager.writeln === 'function') {
                    TerminalManager.writeln('Error saving file');
                }
                alert('Error saving file');
            }
        })
        .catch(error => {
            console.error('Error saving file:', error);
            if (TerminalManager && typeof TerminalManager.writeln === 'function') {
                TerminalManager.writeln(`Error saving file: ${error.message}`);
            }
        });
    }

    // Set editor mode based on file extension
    function setEditorMode(extension) {
        let mode;
        switch(extension.toLowerCase()) {
            case 'js':
                mode = 'ace/mode/javascript';
                break;
            case 'py':
                mode = 'ace/mode/python';
                break;
            case 'html':
                mode = 'ace/mode/html';
                break;
            case 'css':
                mode = 'ace/mode/css';
                break;
            case 'json':
                mode = 'ace/mode/json';
                break;
            case 'md':
                mode = 'ace/mode/markdown';
                break;
            default:
                mode = 'ace/mode/text';
        }
        editor.session.setMode(mode);
    }

    // Event listeners
    saveBtn.addEventListener('click', saveFile);

    // Initialize
    loadProjects();
    
    // Initially clear the file tree if no projects
    if (fileTree.innerHTML === '') {
        fileTree.innerHTML = '<div class="empty-message">Select a project to view files</div>';
    }

    // Highlight changes in the editor
    function highlightEditorChanges(originalCode, newCode) {
        // Parse the original and new code into lines
        const originalLines = originalCode.split('\n');
        const newLines = newCode.split('\n');
        
        // Create a simple diff to identify changed lines
        const diff = [];
        let i = 0, j = 0;
        
        // Use the Longest Common Subsequence approach for a simple diff
        const matches = findMatchingLines(originalLines, newLines);
        
        // Create a map of annotations
        const annotations = [];
        const markers = [];
        
        // Remove any existing markers
        clearEditorMarkers();
        
        // Track changed regions
        let lastType = null;
        let startRow = 0;
        
        // Process the matches to create annotations and markers
        let row = 0;
        for (let i = 0; i < newLines.length; i++) {
            const line = newLines[i];
            const isMatched = matches.some(m => m.newIndex === i);
            
            if (!isMatched) {
                // This is a new or modified line
                annotations.push({
                    row: row,
                    column: 0,
                    text: "Added/Modified",
                    type: "info"
                });
                
                // If this is the start of a new addition region, note the start row
                if (lastType !== 'addition') {
                    startRow = row;
                }
                
                lastType = 'addition';
            } else if (lastType === 'addition') {
                // End of an addition region, create a marker
                createEditorMarker(startRow, row - 1, 'addition');
                lastType = 'match';
            }
            
            row++;
        }
        
        // Create a final marker if we ended with an addition
        if (lastType === 'addition') {
            createEditorMarker(startRow, row - 1, 'addition');
        }
        
        // Set the annotations
        editor.getSession().setAnnotations(annotations);
    }
    
    // Find matching lines between two arrays of strings
    function findMatchingLines(originalLines, newLines) {
        const matches = [];
        
        // For simplicity, we'll use a greedy approach that matches exact lines
        for (let i = 0; i < originalLines.length; i++) {
            for (let j = 0; j < newLines.length; j++) {
                if (originalLines[i] === newLines[j] && 
                    !matches.some(m => m.originalIndex === i || m.newIndex === j)) {
                    matches.push({
                        originalIndex: i,
                        newIndex: j
                    });
                    break;
                }
            }
        }
        
        return matches;
    }
    
    // Clear all markers from the editor
    function clearEditorMarkers() {
        // Get all markers and remove them
        const session = editor.getSession();
        const markers = session.getMarkers();
        
        if (markers) {
            Object.keys(markers).forEach(markerId => {
                session.removeMarker(parseInt(markerId));
            });
        }
    }
    
    // Create a marker in the editor
    function createEditorMarker(startRow, endRow, type) {
        const Range = ace.require('ace/range').Range;
        const session = editor.getSession();
        
        const range = new Range(startRow, 0, endRow, Infinity);
        let cssClass = '';
        
        if (type === 'addition') {
            cssClass = 'editor-line-addition';
        } else if (type === 'deletion') {
            cssClass = 'editor-line-deletion';
        }
        
        return session.addMarker(range, cssClass, "fullLine");
    }
}); 