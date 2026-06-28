import { basename } from 'node:path';
import type { TextDocument } from 'vscode';
import { debug, env, extensions, window, workspace } from 'vscode';
import type { API, GitExtension } from './@types/git';
import LANG from './data/languages.json';

const KNOWN_EXTENSIONS: { [key: string]: { image: string } } = LANG.KNOWN_EXTENSIONS;
const KNOWN_LANGUAGES: { image: string; language: string }[] = LANG.KNOWN_LANGUAGES;

const IDLE_IMAGE_KEY = 'idle-vscode';
const DEBUG_IMAGE_KEY = 'debug';
const VSCODE_IMAGE_KEY = 'vscode';
const VSCODE_INSIDERS_IMAGE_KEY = 'vscode-insiders';
const CURSOR_IMAGE_KEY = 'cursor';

let git: API | null | undefined;

async function getGit() {
	if (git || git === null) return git;

	try {
		const gitExtension = extensions.getExtension<GitExtension>('vscode.git');
		if (!gitExtension?.isActive) await gitExtension?.activate();

		// eslint-disable-next-line require-atomic-updates
		git = gitExtension?.exports.getAPI(1);
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

interface ActivityPayload {
	buttons?: { label: string; url: string }[] | undefined;
	details?: string | undefined;
	largeImageKey?: string | undefined;
	largeImageText?: string | undefined;
	smallImageKey?: string | undefined;
	smallImageText?: string | undefined;
	startTimestamp?: number | null | undefined;
	state?: string | undefined;
	type?: number | undefined;
}

export async function activity(previous: ActivityPayload = {}) {
	const appName = env.appName;
	const gitApi = await getGit();

	const smallImageKey = debug.activeDebugSession
		? DEBUG_IMAGE_KEY
		: appName.includes('Cursor')
			? CURSOR_IMAGE_KEY
			: appName.includes('Insiders')
				? VSCODE_INSIDERS_IMAGE_KEY
				: VSCODE_IMAGE_KEY;

	let detailsText = 'Idling';
	if (gitApi?.repositories.length) {
		const repo = gitApi.repositories.find((rp) => rp.ui.selected);
		const repoName = repo?.state.remotes[0]?.fetchUrl?.split('/')[1]?.replace('.git', '');
		const branch = repo?.state.HEAD?.name;

		if (repoName && branch) detailsText = `Working on ${repoName} on branch ${branch}`;
		else if (repoName) detailsText = `Working on ${repoName}`;
	}

	let state: ActivityPayload = {
		type: 0,
		details: detailsText,
		startTimestamp: previous.startTimestamp ?? Date.now(),
		largeImageKey: IDLE_IMAGE_KEY,
		largeImageText: 'Idling',
		smallImageKey,
		smallImageText: appName,
	};

	// view repository button
	if (gitApi?.repositories.length) {
		let repoUrl = gitApi.repositories.find((rp) => rp.ui.selected)?.state.remotes[0]?.fetchUrl;

		if (repoUrl) {
			if (repoUrl.startsWith('git@') || repoUrl.startsWith('ssh://'))
				repoUrl = repoUrl.replace('ssh://', '').replace(':', '/').replace('git@', 'https://').replace('.git', '');
			else repoUrl = repoUrl.replace(/(https:\/\/)([^@]*)@(.*?$)/, '$1$3').replace('.git', '');

			state = {
				...state,
				buttons: [{ label: 'View Repository', url: repoUrl }],
			};
		}
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
