const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const util = require('util');

const exists = util.promisify(fs.exists);
const readdir = util.promisify(fs.readdir);

var lastFolder = '';
var lastWorkspaceName = '';
var lastWorkspaceRoot = '';

const nodeModules = 'node_modules';

const showError = message => vscode.window.showErrorMessage(`Search node_modules: ${message}`);

exports.activate = context => {
    const searchNodeModules = vscode.commands.registerCommand('extension.search', () => {
        const preferences = vscode.workspace.getConfiguration('search-node-modules');

        const useLastFolder = preferences.get('useLastFolder', false);
        const nodeModulesPath = preferences.get('path', nodeModules);

        const searchPath = (workspaceName, workspaceRoot, folderPath) => {
            // Path to node_modules in this workspace folder
            const workspaceNodeModules = path.join(workspaceName, nodeModulesPath);

            // Reset last folder
            lastFolder = '';
            lastWorkspaceName = '';
            lastWorkspaceRoot = '';

            // Path to current folder
            const folderFullPath = path.join(workspaceRoot, folderPath);

            // Read folder, built quick pick with files/folder (and shortcuts)
            fs.readdir(folderFullPath, (readErr, files) => {
                if (readErr) {
                    if (folderPath === nodeModulesPath) {
                        return showError('No node_modules folder in this workspace.');
                    }

                    return showError(`Unable to open folder ${folderPath}`);
                }

                if (folderPath !== nodeModulesPath) {
                    files.push('');
                    files.push(workspaceNodeModules);
                    files.push('..');
                }

                vscode.window.showQuickPick(files, {
                    placeHolder: path.join(workspaceName, folderPath)
                })
                .then(selected => {
                    // node_modules shortcut selected
                    if (selected === workspaceNodeModules) {
                        searchPath(workspaceName, workspaceRoot, nodeModulesPath);
                    } else {
                        const selectedPath = path.join(folderPath, selected);
                        const selectedFullPath = path.join(workspaceRoot, selectedPath);

                        // If selected is a folder, traverse it,
                        // otherwise open file.
                        fs.stat(selectedFullPath, (statErr, stats) => {
                            if (stats.isDirectory()) {
                                searchPath(workspaceName, workspaceRoot, selectedPath);
                            } else {
                                lastWorkspaceName = workspaceName;
                                lastWorkspaceRoot = workspaceRoot;
                                lastFolder = folderPath;

                                vscode.workspace.openTextDocument(selectedFullPath, selectedPath)
                                .then(vscode.window.showTextDocument);
                            }
                        });
                    }
                });
            });
        };

        const getPackageFolder = async (workspaceFolder) => {
            const packagesPath = path.join(workspaceFolder.uri.fsPath, 'packages');
            if (await exists(packagesPath)) {
                const packages = [];

                await Promise.all((await readdir(packagesPath)).map(async packageFolder => {
                    const packageNodeModulesPath = path.join(packagesPath, packageFolder, nodeModules);
                    if (await exists(packageNodeModulesPath)) {
                        packages.push(packageFolder);
                    }
                }));
                if (packages.length) {
                    const selected = await vscode.window.showQuickPick(
                        [
                            { label: workspaceFolder.name, name: workspaceFolder.name},
                            ...packages.map(packageName => ({ label: `${workspaceFolder.name}/${packageName}`, name: packageName }))
                        ]
                        , { placeHolder: 'Select package' }
                    );
                    if (!selected) {
                        return;
                    }

                    if (selected !== workspaceFolder.name) {
                        return {
                            name: selected.name,
                            path: path.join(packagesPath, selected.name)
                        };
                    }
                }
            }

            return {
                name: path.join(workspaceFolder.name, nodeModulesPath),
                path: workspaceFolder.uri.fsPath
            };
        };

        const getWorkspaceFolder = async () => {
            if (vscode.workspace.workspaceFolders.length === 1) {
                const folder = vscode.workspace.workspaceFolders[0];
                return getPackageFolder(folder);
            }

            const selected = await vscode.window.showQuickPick(vscode.workspace.workspaceFolders.map(folder => ({
                label: folder.name,
                folder
            })), {
                placeHolder: 'Select workspace folder'
            });

            if (!selected) {
                return;
            }

            return getPackageFolder(selected.folder);
        };

        // Open last folder if there is one
        if (useLastFolder && lastFolder) {
            return searchPath(lastWorkspaceName, lastWorkspaceRoot, lastFolder);
        }

        // Must have at least one workspace folder
        if (!vscode.workspace.workspaceFolders.length) {
            return showError('You must have a workspace opened.');
        }

        getWorkspaceFolder().then(folder => {
            if (folder) {
                searchPath(folder.name, folder.path, nodeModulesPath);
            }
        });
    });

    context.subscriptions.push(searchNodeModules);
};

exports.deactivate = () => {};
