// このファイルでは処理内容のテンプレートを定義しています。
// 作りたいコンテンツをこの中の関数から1つ選んで `main` において記載した上で実行します。

import {
	convertToFragment, splitFragment, encrypt, arrangeWithFFmpeg,
	makeDirs, isFileExist
} from "./actions";
import {
	resolutions,
	encryptionKeys,
	originalPath, intermediateDirPath,
	segmentsDirPath, encryptedSegmentsDirPath,
	encryptedMediaPath
} from "./consts";

/**
 * MSE のみを使用するデモコンテンツを作成する
 * * 第1引数: `true` に設定すると、成分 (解像度ごとの映像/音声) に分けたり、フラグメント化する処理をスキップします。前にやっている場合はこのオプションを有効にすることで処理時間が短縮されます。
 */
export const create_demo_of_mse = async (skipFragment: boolean = false) => {
	// 元の動画から音声のみ、映像のみのファイルを生成し、映像のみについては解像度の変更などを行う
	if (!skipFragment) await arrangeAll();

	// それぞれの成分毎の処理を並列に実行する
	await Promise.all(identifiers.map(async (id) => {

		/** 元の (成分毎に分解した直後の) 動画ファイルのパス */
		const raw = `${intermediateDirPath}/raw_${id}.mp4`;
		/** フラグメント化した動画ファイルのパス */
		const fragmented = `${intermediateDirPath}/fragmented_${id}.mp4`;
		/** セグメント毎に別々のファイルに分割した動画ファイルの保存先ディレクトリ */
		const splitted = `${segmentsDirPath}/${id}`;

		// フラグメントに分ける
		if (!skipFragment) await convertToFragment({
			input: raw,
			output: fragmented
		});

		// セグメント毎のファイルの出力先ディレクトリを生成する
		makeDirs(splitted);

		// セグメント毎に別々のファイルに分ける
		await splitFragment({
			input: fragmented,
			output_dir: splitted
		});

	}));
};

/**
 * MSE と EME の両方を使用するデモコンテンツを作成する
 * * 第1引数: `true` に設定すると、成分 (解像度ごとの映像/音声) に分けたり、フラグメント化する処理をスキップします。前にやっている場合はこのオプションを有効にすることで処理時間が短縮されます。
 */
export const create_demo_of_mse_eme = async (skipFragment: boolean = false) => {
	// 元の動画から音声のみ、映像のみのファイルを生成し、映像のみについては解像度の変更などを行う
	if (!skipFragment) await arrangeAll();

	// それぞれの成分毎の処理を並列に実行する
	await Promise.all(identifiers.map(async (id) => {

		/** 元の (成分毎に分解した直後の) 動画ファイルのパス */
		const raw = `${intermediateDirPath}/raw_${id}.mp4`;
		/** フラグメント化した動画ファイルのパス */
		const fragmented = `${intermediateDirPath}/fragmented_${id}.mp4`;
		/** 暗号化した動画ファイルのパス */
		const encrypted = `${intermediateDirPath}/encrypted_${id}.mp4`;
		/** セグメント毎に別々のファイルに分割した動画ファイルの保存先ディレクトリ */
		const splitted = `${encryptedSegmentsDirPath}/${id}`;

		// フラグメントに分ける
		if (!skipFragment) await convertToFragment({
			input: raw,
			output: fragmented
		});

		// 暗号化キーを選択する
		const keys =
			id === "audio" ?
			encryptionKeys.audio :
			encryptionKeys.video;

		// 暗号化する
		await encrypt({
			input: fragmented,
			output: encrypted,
			keys: [
				{
					trackNo: 1,
					...keys
				}
			]
		});

		// セグメント毎のファイルの出力先ディレクトリを生成する
		makeDirs(splitted);

		// セグメント毎に別々のファイルに分ける
		await splitFragment({
			input: encrypted,
			output_dir: splitted
		});

	}));
};

/** EME のみを使用するデモコンテンツを作成する */
export const create_demo_of_eme = async () => {

	/** フラグメント化した動画ファイルのパス */
	const fragmented = `${intermediateDirPath}/fragmented.mp4`;

	// フラグメントに分ける
	await convertToFragment({
		input: originalPath,
		output: fragmented
	});

	// 暗号化する
	await encrypt({
		input: fragmented,
		output: encryptedMediaPath,
		keys: [
			{
				trackNo: 1,
				...encryptionKeys.video
			},
			{
				trackNo: 2,
				...encryptionKeys.audio
			},
		]
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
 * 元の動画から `ffmpeg` を使って成分ごとに分ける処理を実装する
 * * 映像のみ、音声のみのファイルを生成する
 * * 映像のみのファイルは解像度に合わせてスケーリングを行い、解像度を画面左上に表示する
 */
const arrangeAll = async () => {
	// ファイルの存在を確認
	if (!await isFileExist(originalPath)) {
		throw new Error(`動画ファイルが ${originalPath} に存在していません。`);
	}

	// 中間生成ファイルの出力先ディレクトリを作成する
	makeDirs(intermediateDirPath);

	// `ffmpeg` で成分ごとのメディアを作成する
	let index = 0;
	for (const id of identifiers) {
		const outputPath = `${intermediateDirPath}/raw_${id}.mp4`;

		// 音声のみ取り出す
		if (index === 0) {
			await arrangeWithFFmpeg({
				input: originalPath,
				output: outputPath,
				mode: "audio"
			});
		}
		// 映像のみ取り出す
		else {
			const res = resolutions[index-1];
			await arrangeWithFFmpeg({
				input: originalPath,
				output: outputPath,
				mode: "video",
				videoOptions: {
					resolution: res,
					description: `[${res}] %{pts\\:hms}`
				}
			});
		}

		index += 1;
	}
};