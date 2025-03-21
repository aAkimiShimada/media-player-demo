// このファイルではログ出力を管理する

/**
 * 所定の形式のログ出力を行う
 * * 第1引数: ログメッセージ (`string`)
 * * 第2引数以降: ログの先頭に付けるタグ (`"MSE" | "EME" | "Event"`)
 */
export const LOG = (message: string, ...tags: LogTag[]) => {
	logging(
		(...args) => {
			console.groupCollapsed(...args);
			console.trace("トレース情報");
			console.groupEnd();
		},
		message, tags
	);
};

/**
 * 所定の形式のエラーログ出力を行う
 * * 第1引数: ログメッセージ (`string`)
 * * 第2引数以降: ログの先頭に付けるタグ (`"MSE" | "EME" | "Event"`)
 */
export const ERROR = (message: string, ...tags: LogTag[]) => {
	logging(
		(...args) => console.error(...args),
		message, tags
	);
};

/**
 * `LOG` と `ERROR` の実装の本体
 *
 * タグ付けなどはここで行う
 * * 第1引数: 出力先の関数 (`console.log` や `console.error` など)
 * * 第2引数: 出力メッセージの文字列
 * * 第3引数: タグ指定のリスト `LogTag[]`
 */
const logging = (
	func: (...args: any[]) => void,
	message: string, tags: LogTag[]
) => {
	/** テキストのリスト */
	const texts: string[] = [];
	/** スタイルのリスト */
	const styles: string[] = [];

	// メッセージを改行で区切って、各行ごとに処理する
	let isFirstLine = true;
	for (const line of message.split("\n")) {
		// 先頭行でなければ、前の行に対する改行文字を挿入する
		if (!isFirstLine) {
			texts.push("\n");
			styles.push("");
		}

		// タグを追加していく
		for (const tag of tags) {
			let { text, fgColor, bgColor } = tagInfo[tag];

			// スタイルを用意する
			// 先頭行でなければ、タグの分だけスペースを開けるために透明にする
			const style = `
				color: ${isFirstLine ? fgColor : "transparent"};
				background-color: ${isFirstLine ? bgColor : "transparent"};
				${tagStyle}
			`;

			texts.push(text);
			styles.push(style);
		}

		// メッセージ本文を追加する
		texts.push(line);
		styles.push(
			tags.length > 0 ?
			// タグが存在している場合は、タグとテキスト間にパディングを空ける
			"margin-left: 4px; font-weight: normal;" :
			"font-weight: normal;"
		);

		// 次のループは先頭行ではない
		isFirstLine = false;
	}

	// 出力する
	func(
		texts.map(text=>`%c${text}`).join(""),
		...styles
	);
};

/** ログ出力を見やすくするためのタグ指定の型 */
type LogTag = "MSE" | "EME" | "Event";

/** タグの設定をまとめた型 */
interface TagInfo {
	/** 表示されるテキスト */
	text: string;
	/** タグの文字色 */
	fgColor: string;
	/** タグの背景色 */
	bgColor: string;
}

/** 全てのタグのリスト */
const tagInfo: { [name in LogTag]: TagInfo } = {
	// MSE API 関連のログに表示されるタグ
	"MSE": {
		text: "MSE API",
		fgColor: "#f5fff5",
		bgColor: "#669966",
	},
	// EME API 関連のログに表示されるタグ
	"EME": {
		text: "EME API",
		fgColor: "#f5f5ff",
		bgColor: "#666699",
	},
	// トリガされたイベント関連のログに表示されるタグ
	"Event": {
		text: "イベント",
		fgColor: "#fff5f5",
		bgColor: "#996666",
	}
};

/** タグの `color`, `backgroundColor` 以外のスタイル指定 */
const tagStyle = `
	font-family: sans-serif;
	font-weight: bold;
	padding: 2px 6px;
	margin: 0 2px;
	border-radius: 4px;
`;