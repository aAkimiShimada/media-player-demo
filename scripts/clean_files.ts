import {
	readdirSync,
	statSync,
	readFileSync, writeFileSync
} from "node:fs";
import { join as pathJoin } from "node:path";
import { r, regexConcat, regexGroup, regexOr } from "./regex_lib";

// JavaScript ファイルが保存されているディレクトリ
const outputDir = "js_src";

/** 幾つかの所定の処理を引数で渡したパスのディレクトリに含まれる全ての JavaScript ファイルに対して実行する。 */
const cleanJsFiles = (targetDir: string) => {
	const entries = readdirSync(targetDir);

	// ディレクトリに入っている項目ごとに探査する
	for (const file of entries) {
		const path = pathJoin(targetDir, file);

		// ディレクトリの場合はその内側の JavaScript ファイルを探索する
		const stat = statSync(path);
		if (stat.isDirectory() && !stat.isSymbolicLink()) {
			removeJsDocForEmptyStatement(path);
			continue;
		}

		// JavaScript ファイルでない場合は無視
		if (!file.endsWith(".js")) continue;

		// ファイルを書き換える
		cleanJsFile(path);
	}
};

/**
 * 単一のファイルに対して処理内容を定義する
 *
 * 「規定の処理」はここで定義されている
 */
const cleanJsFile = (path: string) => {
	// ファイルを開き、内容を読み込む
	let content = readFileSync(path, "utf-8");

	// 規定の処理を実行する
	content = removeJsDocForEmptyStatement(content);
	content = removeMultipleLineBreaks(content);
	content = changeIndentRule(content);

	// ファイルに上書きする
	writeFileSync(path, content, "utf-8");
};



/**
 * TypeScript をトランスパイルした際に残る不要な JSDoc を削除する
 *
 * `@babel/typescript` によるトラインスパイルで `type` や `interface` は削除されるが、それらに付帯する JSDoc は削除されない。その結果、文 `;` に対して JSDoc が付加された状態になる。
 *
 * このコードでは全ての JavaScript ファイルに対してこうして残った JSDoc を削除している。
 *
 * 引数で JavaScript のソースコードを渡せば、処理を行った JavaScript ソースを返す。
 */
const removeJsDocForEmptyStatement = (jsSrc: string): string => {
	// 後方からマッチさせていくようにするために、文字列を逆順にして取り扱う
	jsSrc = jsSrc.split("").reverse().join("");
	jsSrc = jsSrc.replace(jsDocPattern, "");
	jsSrc = jsSrc.split("").reverse().join("");
	return jsSrc;
};

/** 対象となる JSDoc にマッチするパターン (逆順) */
const jsDocPattern = RegExp(regexConcat([
	regexOr([
		// JSDoc の後にセミコロン ; だけ残っている場合
		r`;\s*`,
		// JSDoc の直後に空行がある場合
		r`[ \t]*[\n\r\v]{2}`,
		// JSDoc の後に改行がいくつか続いて EOF に達する場合
		r`^\s*`
	]),
	r`/\*`, regexConcat([`.*?`]), r`\*\*\/`
]), "gs");



/** 不必要な改行を取り除く */
const removeMultipleLineBreaks = (jsSrc: string): string => {
	// 改行が3個以上連続する場合に2個に置き換える
	jsSrc = jsSrc.replace(/[\n\r\v]{3,}/g, "\n\n");
	// ファイル末尾の改行は取り除く
	jsSrc = jsSrc.replace(/\s+$/,"");
	return jsSrc;
};



/** TypeScript のトランスパイルで標準で使用されるインデントルールを独自のものに変更する */
const changeIndentRule = (jsSrc: string): string => {
	while (indentReplPattern.test(jsSrc)) {
		jsSrc = jsSrc.replace(indentReplPattern, `$<keep>${destIndent}`);
	}
	return jsSrc;
};

/** トランスパイラで使用される標準のインデントルール */
const defaultIndent = "  ";
/** 置換先のインデントルール */
const destIndent = "\t";
/** インデント変換の正規表現 */
const indentReplPattern = RegExp(regexConcat([
	r`^`,
	// 保持するインデント
	regexGroup(
		"keep",
		r`(?:` + destIndent + r`)*`
	),
	// 変換対象のインデント
	r`(?:` + defaultIndent + r`)`
]), "mg");



// 対象となるディレクトリに対して処理を行う
cleanJsFiles(outputDir);