// このファイルではファイル操作関連の関数を実装している

import { mkdir, stat as getStat, writeFile } from "node:fs/promises";

import { color, printLn } from "@lib/output";

import { dryRun } from "~/consts";

/** ディレクトリを作成する */
export const makeDirs =
async (path: string): Promise<void> => {
	// 空実行の場合はパスを出力するだけ
	if (dryRun) {
		console.log(color.green(`Will create a directory in ${path}`));
		return;
	}

	await mkdir(path, { recursive: true });
};

/** ファイルへ書き込む */
export const writeTextToFile =
async (path: string, data: string): Promise<void> => {
	// 空実行の場合はパスと゚愛用を出力するだけ
	if (dryRun) {
		const header = color.green(`Will write this data into ${path}:`);
		printLn(`${header}\n${data}`);
		return;
	}

	await writeFile(path, data, { flag: "w" });
};

/** ファイルの存在を確認する */
export const isFileExist =
async (path: string): Promise<boolean> => {
	try {
		const stat = await getStat(path);
		return stat.isFile();
	}
	// ファイルやディレクトリなどが一切存在していない場合
	catch(_) {
		return false;
	}
};