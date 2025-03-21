import express from "express";
import * as path from "node:path";
import * as process from "node:process";
import { setTimeout } from "node:timers/promises";
import { r, regexOr, regexPathJoin, regexGroup } from "./regex_lib";

/** 起動するサーバに関する設定情報の型 */
interface Info {
	/** スロットリングを有効にするか否か */
	throttling: boolean;
	/** 公開ポート */
	port: number;
}



/** このサーバースクリプトのエントリーポイント */
const main = () => {
	const info = getInfo();
	serve(info);
};

/** サーバーが公開するディレクトリのパス */
const rootPath = path.join(__dirname, "../");

/** サーバーのメイン実装 */
const serve = (info: Info) => {
	const exApp = express();

	// 予め定義したパターンに合致しないパスへのアクセスがあったらブロックする
	exApp.use((request, response, next) => {
		if (!allowAccessPattern.test(request.path)) {
			response.status(404).end();
		}
		else next();
	});

	/**
	 * スロットリングに使用する位相
	 *
	 * 時間遅れは正弦振動により実装されている
	 */
	let phase = 0;

	// カスタマイズ設定を用意する
	exApp.use(async (request, response, next) => {
		// ヘッダーをセット
		response.set({
			"Access-Control-Allow-Origin": "*"
		});

		// スロットリングをしない場合はここで脱ける
		if (!info.throttling) {
			next();
			return;
		}

		// 映像セグメントのパスかどうか判定し、そうでなければここで脱けて、次に進む
		const videoSegment = getInfoOfVideoSegmentPath(request.path);
		if (videoSegment == null) {
			next();
			return;
		}

		// 遅延させる時間を決定する
		const delay =
			2 * (videoSegment.segmentIndex+1) *
			Math.floor( Math.sin( phase / 180 * Math.PI ) * 300 );
		phase = ( phase + 10 ) % 360;

		// 遅延を実行
		await setTimeout(delay);

		// 次の関数に進む
		next();
	});

	// 基本的には静的ファイルの公開にする
	exApp.use(
		express.static(
			rootPath,
			{ index: "index.html" }
		)
	);

	// サーバを起動
	exApp.listen(info.port, () => {
		console.log(`次のアドレスからサーバにアクセスできます: http://localhost:${info.port}`);
		console.log("終了するにはキーボードで Control + C を押します");
	});
};



/**
 * アクセス可能にするファイルのパターン
 *
 * この条件を満たさないパスのファイルへのアクセスリクエストは全て 404 を返す
 */
const allowAccessPattern = (() => {
	/** `js_src` ディレクトリのパターン */
	const js_src = regexPathJoin([
		"js_src", r`[a-z_]+\.js`
	]);

	/** `resources` ディレクトリのパターン */
	const resources = regexPathJoin([
		"resources",
		regexOr([
			"icon.png",
			"[a-z\-]+\.css"
		])
	]);

	/** `media` ディレクトリのうち、セグメント関連のディレクトリのパターン */
	const segments = regexPathJoin([
		regexOr([
			"segments",
			"segments_encrypted"
		]),
		regexOr([ r`audio`, r`video_[1-5]` ]),
		regexOr([ r`init\.mp4`, r`seg\-[0-9]+\.m4s` ])
	]);

	/** `media` ディレクトリのうち、 DASH を使うセグメント関連のディレクトリのパターン */
	const segments_dash = regexPathJoin([
		regexOr([
			"segments_dash",
			"segments_encrypted_dash"
		]),
		regexOr([
			"audio/en/mp4a.40.2",
			r`video/avc1/[1-5]`
		]),
		regexOr([ r`init\.mp4`, r`seg\-[0-9]+\.m4s` ])
	]);

	/** `media` ディレクトリのパターン */
	const media = regexPathJoin([
		"media",
		regexOr([
			"movie.mp4",
			"encrypted.mp4",
			segments,
			segments_dash
		])
	]);

	/** アクセス可能な全てのパスのパターン */
	const whole = "/" + regexOr([
		"", // 空文字列は http://localhost:8080/ を許可している
		"index.html",
		js_src,
		resources,
		media
	]);

	// 正規表現として構成して返す
	return RegExp(r`^${whole}$`);
})();



/**
 * 映像セグメントのパスから構成要素を取得する関数
 * * 第1引数: パス文字列
 * * 戻り値: 構成要素が入ったデータ (`Info`) or `null`
 *      * `Info` は `{ resolution, segmentIndex }` のエイリアスである。
 *      * 引数が映像セグメントのパスであれば `Info` を、さもなくば `null` を返す。
 */
const getInfoOfVideoSegmentPath = (() => {
	/** パスのパターン */
	const pattern = RegExp(
		regexPathJoin([
			"", "media",
			regexOr(["segments", "segments_encrypted"]),
			`video_${regexGroup(
				"resolution", r`[1-5]`
			)}`,
			`seg-${regexGroup(
				"segmentIndex", r`[0-9]+`
			)}${r`\.m4s`}`,
		])
	);

	/** 正規表現 `pattern` でマッチした時に得られるキャプチャグループ */
	interface Group {
		resolution: string;
		segmentIndex: string;
	}

	/** 映像セグメントのパスから得られる情報 */
	interface Info {
		/** 解像度の番号 */
		resolution: number;
		/** セグメントの番号 */
		segmentIndex: number;
	}

	return (target: string): Info | null => {
		const match = pattern.exec(target);

		// マッチしない場合は抜ける
		if (match == null) return null;

		// キャプチャグループを取得する
		const group = (match.groups as unknown) as Group;

		return {
			resolution: parseInt(group.resolution),
			segmentIndex: parseInt(group.segmentIndex)
		};
	};
})();



/** 設定情報を用意する */
const getInfo = (): Info => {
	// 初期設定
	let throttling: boolean = false;
	let port: number = 8080;

	// コマンドライン引数から設定する
	const args = process.argv.slice(2);
	if ((args.length === 1) && (args[0] === "throttling")) {
		throttling = true;
	}

	return { throttling, port };
};



// `main` を呼び出す
main();