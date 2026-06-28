// Trimmed from vscode's extensions/git/src/api/git.d.ts
// Only types actually used by this extension

import { Uri, Event } from 'vscode';

export interface Ref {
	readonly name?: string;
}

export interface Branch extends Ref {}

export interface Remote {
	readonly name: string;
	readonly fetchUrl?: string;
}

export interface RepositoryState {
	readonly HEAD: Branch | undefined;
	readonly remotes: Remote[];
}

export interface RepositoryUIState {
	readonly selected: boolean;
}

export interface Repository {
	readonly rootUri: Uri;
	readonly state: RepositoryState;
	readonly ui: RepositoryUIState;
}

export interface API {
	readonly repositories: Repository[];
}

export interface GitExtension {
	getAPI(version: 1): API;
}
