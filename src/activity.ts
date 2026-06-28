import { basename } from 'node:path';
import type { TextDocument } from 'vscode';
import { debug, env, extensions, window, workspace } from 'vscode';
import LANG from './data/languages.json';

const KNOWN_EXTENSIONS: { [key: string]: { image: string } } = LANG.KNOWN_EXTENSIONS;
const KNOWN_LANGUAGES: { image: string; language: string }[] = LANG.KNOWN_LANGUAGES;

interface GitExtension {
	getAPI(version: 1): { readonly repositories: GitRepository[] };
}

interface GitRepository {
	readonly state: {
		readonly HEAD: { readonly name?: string } | undefined;
		readonly remotes: { readonly fetchUrl?: string }[];
	};
	readonly ui: { readonly selected: boolean };
}

let git: { readonly repositories: GitRepository[] } | null | undefined;

async function getGit() {
	if (git || git === null) return git;

	try {
		const ext = extensions.getExtension<GitExtension>('vscode.git');
		if (!ext?.isActive) await ext?.activate();

		// eslint-disable-next-line require-atomic-updates
		git = ext?.exports.getAPI(1);
	} catch {
		// eslint-disable-next-line require-atomic-updates
		git = null;
	}

	return git;
}

function resolveFileIcon(document: TextDocument) {
	const filename = basename(document.fileName);
	const findKnownExtension = Object.keys(KNOWN_EXTENSIONS).find((key) => {
		if (filename.endsWith(key)) return true;

		const match = /^\/(.*)\/([gimy]+)$/.exec(key);
		if (!match) return false;

		const regex = new RegExp(match[1] as string, match[2] as string);
		return regex.test(filename);
	});
	const findKnownLanguage = KNOWN_LANGUAGES.find((key) => key.language === document.languageId);
	const fileIcon = findKnownExtension
		? KNOWN_EXTENSIONS[findKnownExtension]
		: findKnownLanguage
			? findKnownLanguage.image
			: null;

	return typeof fileIcon === 'string' ? fileIcon : (fileIcon?.image ?? 'text');
}

export async function activity(previous: Record<string, unknown> = {}) {
	const appName = env.appName;
	const gitApi = await getGit();

	const smallImageKey = debug.activeDebugSession
		? 'debug'
		: appName.includes('Cursor')
			? 'cursor'
			: appName.includes('Insiders')
				? 'vscode-insiders'
				: 'vscode';

	let detailsText = 'Idling';
	const repo = gitApi?.repositories.length ? gitApi.repositories.find((rp) => rp.ui.selected) : undefined;

	if (repo) {
		const repoName = repo.state.remotes[0]?.fetchUrl?.split('/')[1]?.replace('.git', '');
		const branch = repo.state.HEAD?.name;

		if (repoName && branch) detailsText = `Working on ${repoName} on branch ${branch}`;
		else if (repoName) detailsText = `Working on ${repoName}`;
	}

	let state: Record<string, unknown> = {
		type: 0,
		details: detailsText,
		startTimestamp: (previous.startTimestamp as number | undefined) ?? Date.now(),
		largeImageKey: 'idle-vscode',
		largeImageText: 'Idling',
		smallImageKey,
		smallImageText: appName,
	};

	// view repository button
	let repoUrl = repo?.state.remotes[0]?.fetchUrl;
	if (repoUrl) {
		if (repoUrl.startsWith('git@') || repoUrl.startsWith('ssh://'))
			repoUrl = repoUrl.replace('ssh://', '').replace(':', '/').replace('git@', 'https://').replace('.git', '');
		else repoUrl = repoUrl.replace(/(https:\/\/)([^@]*)@(.*?$)/, '$1$3').replace('.git', '');

		state = { ...state, buttons: [{ label: 'View Repository', url: repoUrl }] };
	}

	if (window.activeTextEditor) {
		const largeImageKey = resolveFileIcon(window.activeTextEditor.document);
		const relativePath = workspace.asRelativePath(window.activeTextEditor.document.fileName);
		const action = debug.activeDebugSession ? 'Debugging' : 'Editing';

		state = {
			...state,
			largeImageKey,
			largeImageText: `${action} a ${largeImageKey.toLocaleUpperCase()} file`,
			state: `${action} ${relativePath}`,
		};
	}

	return state;
}
