import { debug, env, window, workspace } from 'vscode';
import {
	CONFIG_KEYS,
	CURSOR_IMAGE_KEY,
	DEBUG_IMAGE_KEY,
	IDLE_IMAGE_KEY,
	VSCODE_IMAGE_KEY,
	VSCODE_INSIDERS_IMAGE_KEY,
} from './constants';
import { getConfig, getGit, resolveFileIcon } from './util';

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
	const config = getConfig();
	const appName = env.appName;
	const git = await getGit();

	const smallImageKey = debug.activeDebugSession
		? DEBUG_IMAGE_KEY
		: appName.includes('Cursor')
			? CURSOR_IMAGE_KEY
			: appName.includes('Insiders')
				? VSCODE_INSIDERS_IMAGE_KEY
				: VSCODE_IMAGE_KEY;

	// build details line from git info
	let detailsText = 'Idling';
	if (git?.repositories.length) {
		const repo = git.repositories.find((rp) => rp.ui.selected);
		const repoName = repo?.state.remotes[0]?.fetchUrl?.split('/')[1]?.replace('.git', '');
		const branch = repo?.state.HEAD?.name;

		if (repoName && branch) detailsText = `Working on ${repoName} on branch ${branch}`;
		else if (repoName) detailsText = `Working on ${repoName}`;
	}

	let state: ActivityPayload = {
		type: 0,
		details: detailsText,
		startTimestamp: config[CONFIG_KEYS.RemoveTimestamp] ? undefined : (previous.startTimestamp ?? Date.now()),
		largeImageKey: IDLE_IMAGE_KEY,
		largeImageText: 'Idling',
		smallImageKey,
		smallImageText: appName,
	};

	// view repository button
	if (!config[CONFIG_KEYS.RemoveRemoteRepository] && git?.repositories.length) {
		let repoUrl = git.repositories.find((rp) => rp.ui.selected)?.state.remotes[0]?.fetchUrl;

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
