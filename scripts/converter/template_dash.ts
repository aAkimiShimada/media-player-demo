// このファイルでは処理内容のテンプレートを定義しています。
// MPEG-DASH の MPD ファイルもまとめて生成するタイプのテンプレートを用意しているので、 MPEG-DASH でも使用できるはずです。 (未検証)
// 作りたいコンテンツをこの中の関数から1つ選んで `main` において記載した上で実行します。

import {
	convertToFragment, createDashSegments, encrypt, arrangeWithFFmpeg,
	makeDirs, isFileExist,
	type EncryptInfo
} from "./actions";
import {
	resolutions,
	encryptionKeys,
	originalPath, intermediateDirPath,
	segmentsDashDirPath, encryptedSegmentsDashDirPath
} from "./consts";

// `template.ts` に含まれているテンプレートでは `ffmpeg` を使った処理の時点で映像と音声を分けていたが、こちらでは `mp4fragment` によるフラグメント化において初めて映像と音声を分ける
// Stream ID は、おそらく元の動画ファイルでは映像が 1 、音声が 2 になっているはずだ
// * `ffmpeg` で分けると映像と音声の Stream ID が共に 1 となる
// * `mp4fragment` で分けると元の動画と同じく映像が 1 、音声が 2 となる

/**
 * MSE のみを使用するデモコンテンツを作成し、 DASH の仕様に合わせて構成する。
 * * 第1引数: `true` に設定すると、成分 (解像度ごとの映像/音声) に分けたり、フラグメント化する処理をスキップします。前にやっている場合はこのオプションを有効にすることで処理時間が短縮されます。
 */
export const create_demo_of_mse_dash = async (skipFragment: boolean = false) => {
	// 元の動画から映像の解像度を変更した動画ファイルを生成する
	if (!skipFragment) await arrangeAll();

	/** 成分ごとのパラメータを定義する型 */
	type Params = {
		/** 元の (成分毎に分解した直後の) 動画ファイルのパス */
		raw: string;
		/** フラグメント化した動画ファイルのパス */
		fragmented: string;
		/** フラグメント化の時点で取り出すトラックの種類 */
		track: "video" | "audio";
	};

	// 成分ごとのパラメータを用意する
	const params: Params[] = identifiers.map((id, index) => {
		return {
			raw: `${intermediateDirPath}/raw_${index === 0 ? 1 : index}.mp4`,
			fragmented: `${intermediateDirPath}/fragmented_${id}.mp4`,
			track: index === 0 ? "audio" : "video"
		};
	});

	// それぞれの成分毎の処理を並列に実行する
	if (!skipFragment) await Promise.all(params.map(async (param) => {
		// パラメータを分解
		const { raw, fragmented, track } = param;

		// フラグメントに分ける
		await convertToFragment({
			input: raw,
			output: fragmented,
			track
		});
	}));

	// 出力先ディレクトリを生成する
	makeDirs(segmentsDashDirPath);

	// DASH を生成する
	await createDashSegments({
		// 全てのフラグメント化済み動画ファイルを渡す
		input: params.map(({ fragmented }) => fragmented),
		output_dir: segmentsDashDirPath
	});
};

/**
 * MSE と EME の両方を使用するデモコンテンツを作成し、 DASH の仕様に合わせて構成する。
 * * 第1引数: `true` に設定すると、成分 (解像度ごとの映像/音声) に分けたり、フラグメント化する処理をスキップします。前にやっている場合はこのオプションを有効にすることで処理時間が短縮されます。
 */
export const create_demo_of_mse_eme_dash = async (skipFragment: boolean = false) => {
	// 元の動画から映像の解像度を変更した動画ファイルを生成する
	if (!skipFragment) await arrangeAll();

	/** 成分ごとのパラメータを定義する型 */
	type Params = {
		/** 元の (成分毎に分解した直後の) 動画ファイルのパス */
		raw: string;
		/** フラグメント化した動画ファイルのパス */
		fragmented: string;
		/** 暗号化した動画ファイルのパス */
		encrypted: string;
		/** フラグメント化の時点で取り出すトラックの種類 */
		track: "video" | "audio";
		/** 暗号化キー */
		keys: EncryptInfo["keys"]
	};

	// 成分ごとのパラメータを用意する
	const params: Params[] = identifiers.map((id, index) => {
		return {
			raw: `${intermediateDirPath}/raw_${index === 0 ? 1 : index}.mp4`,
			fragmented: `${intermediateDirPath}/fragmented_${id}.mp4`,
			encrypted: `${intermediateDirPath}/encrypted_${id}.mp4`,
			track: index === 0 ? "audio" : "video",
			keys: [
				index > 0 ?
				{
					trackNo: 1,
					...encryptionKeys.video
				} :
				{
					trackNo: 2,
					...encryptionKeys.audio
				}
			]
		};
	});

	// それぞれの成分毎の処理を並列に実行する
	await Promise.all(params.map(async (param) => {
		// パラメータを分解
		const { raw, fragmented, encrypted, track, keys } = param;

		// フラグメントに分ける
		if (!skipFragment) await convertToFragment({
			input: raw,
			output: fragmented,
			track
		});

		// 暗号化する
		await encrypt({
			input: fragmented,
			output: encrypted,
			keys
		});
	}));

	// 出力先ディレクトリを生成する
	makeDirs(encryptedSegmentsDashDirPath);

	// DASH を生成する
	await createDashSegments({
		// 全ての暗号化済み動画ファイルを渡す
		input: params.map(({encrypted}) => encrypted),
		output_dir: encryptedSegmentsDashDirPath
	});
};

/**
 * 成分毎の識別子
 *
 * 動画の映像成分/音声成分に分け、かつ映像成分も解像度毎に分けている
 */
const identifiers = [
	"audio",
	...resolutions.map((_,index) => `video_${index+1}`)
];

/**
 * 元の動画から `ffmpeg` を使って解像度ごとに分ける処理を実装する
 * * 映像は解像度に合わせてスケーリングを行い、解像度を画面左上に表示する
 * * 音声はそのままにする
 */
const arrangeAll = async () => {
	// ファイルの存在を確認
	if (!await isFileExist(originalPath)) {
		throw new Error(`動画ファイルが ${originalPath} に存在していません。`);
	}

	// 中間生成ファイルの出力先ディレクトリを作成する
	makeDirs(intermediateDirPath);

	// `ffmpeg` で解像度ごとのメディアを作成する
	let index = 1;
	for (const res of resolutions) {
		const outputPath = `${intermediateDirPath}/raw_${index}.mp4`;

		await arrangeWithFFmpeg({
			input: originalPath,
			output: outputPath,
			mode: "both",
			videoOptions: {
				resolution: res,
				description: `[${res}] %{pts\\:hms}`
			}
		});

		index += 1;
	}
};