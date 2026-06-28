import { Client } from '@xhayper/discord-rpc';
import type { ExtensionContext, StatusBarItem } from 'vscode';
import { commands, StatusBarAlignment, window, workspace, debug } from 'vscode';
import { activity } from './activity';

const CLIENT_ID = '383226320970055681';
const outputChannel = window.createOutputChannel('Discord Presence');

function log(message: string) {
	outputChannel.appendLine(`[${new Date().toLocaleString('en-GB')}] ${message}`);
}

const statusBarIcon: StatusBarItem = window.createStatusBarItem('discord.statusbar', StatusBarAlignment.Left);
statusBarIcon.name = 'Discord Presence';
statusBarIcon.text = '$(pulse) Connecting to Discord...';

let rpc = new Client({ transport: { type: 'ipc' }, clientId: CLIENT_ID });
const config = workspace.getConfiguration('discord');

let state = {};
let focused = true;
let idle: NodeJS.Timeout | undefined;
let listeners: { dispose(): any }[] = [];

function cleanUp() {
	for (const listener of listeners) listener.dispose();
	listeners = [];
}

async function sendActivity() {
	if (!focused) return;

	// eslint-disable-next-line require-atomic-updates
	state = {
		...(await activity(state)),
	};
	void rpc.user?.setActivity(state);
}

async function login() {
	log('Creating discord-rpc client');
	rpc = new Client({ transport: { type: 'ipc' }, clientId: CLIENT_ID });

	rpc.on('ready', () => {
		log('Successfully connected to Discord');
		cleanUp();

		statusBarIcon.text = '$(globe) Connected to Discord';
		statusBarIcon.tooltip = 'Connected to Discord';
		statusBarIcon.command = 'discord.disconnect';

		void sendActivity();
		const onChangeActiveTextEditor = window.onDidChangeActiveTextEditor(async () => sendActivity());
		const onStartDebugSession = debug.onDidStartDebugSession(async () => sendActivity());
		const onTerminateDebugSession = debug.onDidTerminateDebugSession(async () => sendActivity());

		listeners.push(onChangeActiveTextEditor, onStartDebugSession, onTerminateDebugSession);
	});

	rpc.on('disconnected', () => {
		cleanUp();
		void rpc.destroy();

		statusBarIcon.text = '$(pulse) Reconnect to Discord';
		statusBarIcon.command = 'discord.reconnect';
	});

	try {
		await rpc.login();
	} catch (error) {
		log(`Encountered following error while trying to login:\n${error as string}`);
		cleanUp();
		void rpc.destroy();
		// @ts-expect-error: error is not typed
		if (error?.message?.includes('ENOENT')) void window.showErrorMessage('No Discord client detected');
		else void window.showErrorMessage(`Couldn't connect to Discord via RPC: ${error as string}`);

		statusBarIcon.text = '$(pulse) Reconnect to Discord';
		statusBarIcon.command = 'discord.reconnect';
	}
}

export async function activate(context: ExtensionContext) {
	log('Discord Presence activated');

	const connect = () => {
		log('Cleaning up old listeners');
		cleanUp();
		statusBarIcon.text = '$(pulse) Connecting to Discord...';
		statusBarIcon.show();
		log('Attempting to recreate login');
		void login();
	};

	const destroyRpc = () => {
		log('Cleaning up old listeners');
		cleanUp();
		void rpc?.destroy();
		log('Destroyed the rpc instance');
		statusBarIcon.hide();
	};

	const reconnecter = commands.registerCommand('discord.reconnect', () => {
		destroyRpc();
		connect();
	});

	const disconnecter = commands.registerCommand('discord.disconnect', () => {
		destroyRpc();
		statusBarIcon.text = '$(pulse) Reconnect to Discord';
		statusBarIcon.command = 'discord.reconnect';
		statusBarIcon.show();
	});

	context.subscriptions.push(reconnecter, disconnecter);

	statusBarIcon.show();
	await login();

	window.onDidChangeWindowState(async (windowState) => {
		if (windowState.focused) {
			log('Window focused');
			focused = true;

			if (idle) {
				// eslint-disable-next-line no-restricted-globals
				clearTimeout(idle);
				idle = undefined;
			}

			state = {};
			await sendActivity();
		} else if (focused) {
			log('Window unfocused');
			focused = false;

			if (config.get<number>('idleTimeout', 1_800) !== 0) {
				const timeout = config.get<number>('idleTimeout', 1_800)!;
				log(`Idle timeout set for ${timeout}s, clearing presence after`);
				// eslint-disable-next-line no-restricted-globals
				idle = setTimeout(async () => {
					log('Idle timeout reached, clearing presence');
					state = {};
					await rpc.user?.clearActivity();
				}, timeout * 1_000);
			}
		}
	});
}

export function deactivate() {
	cleanUp();
	void rpc.destroy();
}
