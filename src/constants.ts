import LANG from './data/languages.json';

export const CLIENT_ID = '383226320970055681' as const;

export const KNOWN_EXTENSIONS: { [key: string]: { image: string } } = LANG.KNOWN_EXTENSIONS;
export const KNOWN_LANGUAGES: { image: string; language: string }[] = LANG.KNOWN_LANGUAGES;

export const IDLE_IMAGE_KEY = 'idle-vscode' as const;
export const DEBUG_IMAGE_KEY = 'debug' as const;
export const VSCODE_IMAGE_KEY = 'vscode' as const;
export const VSCODE_INSIDERS_IMAGE_KEY = 'vscode-insiders' as const;
export const CURSOR_IMAGE_KEY = 'cursor' as const;

export const enum CONFIG_KEYS {
	Enabled = 'enabled',
	IdleTimeout = 'idleTimeout',
	RemoveRemoteRepository = 'removeRemoteRepository',
	RemoveTimestamp = 'removeTimestamp',
	SuppressNotifications = 'suppressNotifications',
	WorkspaceExcludePatterns = 'workspaceExcludePatterns',
}
