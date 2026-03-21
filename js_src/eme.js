// このファイルでは EME 関連の処理を実装している
import { videoMimeType, audioMimeType, encryptionKeys } from "./consts.js";
import { arrayBufferToString, stringToArrayBuffer, base64ToHex, binaryToHex, hexToBase64 } from "./eme_utils.js";
import { createMutexManager } from "./utils.js";
import { LOG, ERROR } from "./log.js";
/** 暗号化のキーシステムの種類を与える定数 */
const keySystem = "org.w3.clearkey";
// Clear Key を使うことを表す定数
// Clear Key の詳細: https://w3c.github.io/encrypted-media/#clear-key

/** キーシステムに関する構成情報を規定する */
const configs = [{
	// 初期化データの種類
	initDataTypes: ["cenc", "webm"],
	// Clear Key では `cenc` への対応が必須で、オプションとして他の形式に対応させることができる (参考: https://www.w3.org/TR/encrypted-media/#clear-key-capabilities)
	// `cenc` は ISO/IEC 23001-7 で定められた MP4 特有の形式である
	// 一方で `webm` は https://www.w3.org/TR/eme-initdata-webm/ で定められた WebM 特有の形式である
	// 映像の復号化に関する情報
	videoCapabilities: [{
		contentType: videoMimeType
	}],
	// 音声の復号化に関する情報
	audioCapabilities: [{
		contentType: audioMimeType
	}]
}];

/**
 * 与えた `video` 要素に対して EME API を使った Clear Key での復号化のセットアップを行う
 * * 第1引数: `video` 要素の DOM (`HTMLVideoElement`)
 */
export const setupEME = video => {
	// 内部で `getMediaKeys` が同時に呼び出されないようにロック機構を導入する
	const mutex = createMutexManager();

	// `video` 要素において、受け取った動画ファイルが暗号化されていることを検知した時に呼び出すイベントのハンドラ
	// 検知した時に復号化の手続きを始める
	// 1回しか呼び出されないようにハンドラを設定する
	video.addEventListener("encrypted", event => {
		LOG("video 要素から encrypted イベントが呼ばれました", "EME", "Event");
		startDecryption(video, event, mutex);
	});
};

/**
 * `video` 要素からの要請を受けて復号化を開始する
 * * 第1引数: `video` 要素の DOM (`HTMLVideoElement`)
 * * 第2引数: イベント (`MediaEncryptedEvent`)
 *     * `video` 要素の `encrypted` イベントから取得できる
 * * 第3引数: ミューテックス (`MutexManager`)
 *     * `MediaKeys` の作成が同時に行われないようにする
 * */
const startDecryption = async (video, event, mutex) => {
	// 初期化データの形式として、 Clear Key では cenc (MP4 コンテナ) と webm (WebM コンテナ) にのみ対応しているので、ブラウザがそれ以外の形式を要求してきたらここでブロックする
	LOG(`要求された初期化データの形式: ${event.initDataType}`, "EME");
	if (event.initDataType !== "cenc" && event.initDataType !== "webm") {
		ERROR("Clear Key で対応していない初期化データの形式が要求されたため復号化できません", "EME");
		return;
	}

	// `MediaKeys` を作成する
	// 前に `encrypted` イベントを呼び出したことがあって、既に作ったことがあれば、それを利用する。
	// 同時に `MediaKeys` を取得しようとした場合は、先に取得しようとした方から順番に返すようにするために `mutex` を使っている。
	const mediaKeys = await mutex.add(() => getMediaKeys(video));

	// CDM とやり取りするためのセッションを用意する
	await setupSession(mediaKeys, event);
};

/**
 * `MediaKeys` を取得し、 `video` 要素にセットする
 *
 * 注意: **この関数は同時に複数回呼び出すことはできません**。同時にならないように対処する必要があります。
 *
 * * 第1引数: `video` 要素の DOM (`HTMLVideoElement`)
 */
const getMediaKeys = async video => {
	// 既に `MediaKeys` を作成しており、 `video` 要素と関連付けられているのであれば、これを利用する。
	const existingMediaKeys = video.mediaKeys;
	if (existingMediaKeys != null) return existingMediaKeys;

	// 指定したキーシステムが使用できるかどうか判定するし、できる場合はアクセス用のオブジェクトを作成する
	// 指定のキーシステムに非対応の場合などは、エラーを返す
	const keySystemAccess = await navigator.requestMediaKeySystemAccess(keySystem, configs).catch(error => {
		ERROR("キーシステムにアクセスできません", "EME");
		throw error;
	});
	LOG("キーシステムへのアクセスが確立しました", "EME");

	// `MediaKeys` を作成する
	// `MediaKeys` は `video` 要素などでキーを使えるようにするためのオブジェクトである
	const mediaKeys = await keySystemAccess.createMediaKeys().catch(error => {
		ERROR("MediaKeys の作成に失敗しました", "EME");
		throw error;
	});
	LOG("MediaKeys を作成しました", "EME");

	// `MediaKeys` を `video` 要素にセットする
	await video.setMediaKeys(mediaKeys).catch(error => {
		ERROR("MediaKeys を video 要素にセットできませんでした", "EME");
		throw error;
	});
	LOG("MediaKeys を video 要素にセットしました", "EME");

	// 新しく用意した `mediaKeys` を返す
	return mediaKeys;
};

/**
 * CDM とやり取りを行うセッションを用意する
 * * 第1引数: `MediaKeys`
 * * 第2引数: イベント (`MediaEncryptedEvent`)
 *     * `video` 要素の `encrypted` イベントから取得できる
 */
const setupSession = async (mediaKeys, event) => {
	// CDM とやり取りするためのセッションを作成する
	const session = mediaKeys.createSession("temporary");

	// セッションにイベントハンドラを設定する

	// CDM からメッセージを受け取った (= 鍵を CDM に送るようにリクエストを受けた) とき
	session.addEventListener("message", function (event) {
		LOG("MediaKeySession から message イベントが呼ばれました", "EME", "Event");
		passEncryptionKeys(this, event);
	});
	// CDM の鍵の状態が変更されたとき
	session.addEventListener("keystatuseschange", function () {
		LOG("MediaKeySession から keystatuschange イベントが呼ばれました", "EME", "Event");
		changeKeyStatusOfSession(this);
	});
	LOG("CDM とやり取りするセッションが準備できました", "EME");

	// CDM にライセンスのリクエストをするように求める
	await session.generateRequest(
	// 初期化データの形式 (`configs` でも指定した通り、ここでは `cenc` だろう)
	event.initDataType,
	// 初期化データ
	event.initData).catch(error => {
		ERROR("CDM へのリクエスト送信に失敗しました", "EME");
		throw error;
	});
	LOG("CDM にリクエストを送信しました", "EME");
};

/**
 * CDM からメッセージを受け取った時に呼び出す関数
 * * メッセージを受け取り、合わせて返答 (`MediaKeySession.update`) を行っている
 * * 通常は CDM からライセンスキーの提供依頼を受け、ライセンス情報を渡すのに使用する
 * * `Clear Key` なので用意したキーをそのまま渡すだけで済むが、 Widevine など他のキーシステムを利用している場合はライセンスサーバとのやり取りの後に返答を行う
 *
 * * 第1引数: CDM とやり取りするセッション
 * * 第2引数: メッセージ受信のイベント (`MediaKeyMessageEvent`)
 *     * `MediaKeySession` の `message` イベントで受け取れる
 */
const passEncryptionKeys = (session, event) => {
	// CDM からのメッセージを `ArrayBuffer` として渡されるので、文字列に変換して受け取る
	const messageBuffer = event.message;
	const messageJson = arrayBufferToString(messageBuffer);
	LOG(["CDM からライセンスリクエストのメッセージを受け取りました", `メッセージの内容: ${messageJson}`].join("\n"), "EME");

	// メッセージは JSON であるから、パースして所定の形式のオブジェクトとして取り扱う
	const message = JSON.parse(messageJson);

	// 用意した `{ video: KeyPair, audio: KeyPair }` の形式のオブジェクトから、 `KeyPair` だけを取り出して `KeyPair[]` の形式にしておく
	const keyPairs = Object.values(encryptionKeys);

	// CDM に渡すキーリスト
	const keysList = [];

	// CDM からリクエストされた対象の key id の1つ1つに対して、対応するキーを探し、見つかったら `keysList` に追加する
	for (const base64Kid of message.kids) {
		// 16進数形式に変換する
		const hexKid = base64ToHex(base64Kid).toLowerCase();
		// 見つける
		const found = keyPairs.find(pair => pair.keyId == hexKid);
		// 見つからなかった場合
		if (found == undefined) {
			ERROR(`キーID ${hexKid} に対応するキーが見つかりませんでした`, "EME");
			continue;
		}
		LOG(`キーID ${hexKid} に対応するキーが見つかりました`, "EME");

		// キーを Base64 形式で用意する
		const hexKey = found.key;
		const base64Key = hexToBase64(hexKey);

		// リストに追加
		keysList.push({
			kty: "oct",
			kid: base64Kid,
			k: base64Key
		});
	}

	// CDM に返答する内容を用意する
	const update = {
		keys: keysList,
		type: message.type // `message` と同じ値でいい
	};

	// JSON の文字列に変換する
	const updateJson = JSON.stringify(update);
	LOG(["CDM に渡すキーに関するメッセージ:", updateJson].join("\n"), "EME");

	// `ArrayBuffer` にする
	const updateBuffer = stringToArrayBuffer(updateJson);

	// CDM に送信する
	session.update(updateBuffer).then(() => {
		LOG("キーを CDM に送信できました", "EME");
	}).catch(error => {
		ERROR("キーの CDM への送信に失敗しました", "EME");
		throw error;
	});
};

/**
 * キーの状態が変化した時に呼び出す関数
 *
 * ここでいう変化する「状態」とは、例えばキーが認証中という状態とか、認証が成功したという状態などがある。
 *
 * ここでは単に変更点をログに出力するためだけにしか使っていないが、認証が成功してからでないと、動画の読み込みは進めるべきではない。
 *
 * * 第1引数: CDM とやり取りするセッション
 */
const changeKeyStatusOfSession = session => {
	// キーごとのステータスがまとまった辞書
	const statusMap = session.keyStatuses;

	// 1つずつ調べて、文字列にして表す
	const descKeys = Array.from(statusMap.entries()).map(([bsKid, status]) => {
		// 16進数の形式で `keyId` を得る
		// `BufferSource` 型たる `bsKid` は、 `BufferSource` の1要素である `ArrayBuffer` だとみなして良い
		const binKid = arrayBufferToString(bsKid);
		const hexKid = binaryToHex(binKid);
		return `keyId=${hexKid} status=${status}`;
	});

	// 内容をログに出力
	LOG(["セッションに付帯するキーの状態に変化があったようです", ...descKeys].join("\n"), "EME");
};