// このファイルは、 `ConvertDescription` をはじめとする、変換の方式を規定する型を定義している。

/**
 * 動画変換の方式を設定するオブジェクト型
 *
 * 使用するツールの指定や、使用するコンテナ、コーデックの設定ができる
 */
export type ConvertDescription = (
	| ConvertDescriptionFFmpeg
	| ConvertDescriptionBento4
	| ConvertDescriptionMP4Box
	| ConvertDescriptionGpac
	| ConvertDescriptionShakaPackager
);

/** 内部でのみ使用される、 `ConvertDescription` の制約を緩めた型 */
export type ConvertDescriptionGeneric<C extends Container.Type = Container.Type> = (
	& ConvertDescTool
	& ConvertDescRunMode<true>
	& ConvertDescContainerCodec<C>
	& ConvertDescPssh<true>
	& ConvertDescPiff<true>
	& ConvertDescDirect<true>
	& ConvertDescSkipPreprocess<true>
	& ConvertDescEmitMpd<true>
);

/** `ConvertDescription` 型のうち、 `Tool.FFmpeg` が指定された場合を取り扱う型 */
export type ConvertDescriptionFFmpeg = (
	& ConvertDescTool<typeof Tool.FFmpeg>
	& ConvertDescRunMode<true>
	& ConvertDescContainerCodec
	& ConvertDescPssh<false>
	& ConvertDescPiff<false>
	& (
		| (
			& Required<ConvertDescDirect<true, true>>
			& ConvertDescSkipPreprocess<false>
		)
		| (
			& ConvertDescDirect<true, false>
			& ConvertDescSkipPreprocess<true>
		)
	)
	& ConvertDescEmitMpd<true>
);

/** `ConvertDescription` 型のうち、 `Tool.Bento4` が指定された場合を取り扱う型 */
export type ConvertDescriptionBento4 = (
	& ConvertDescTool<typeof Tool.Bento4>
	& ConvertDescRunMode<true>
	& ConvertDescContainerCodecMP4Only
	& ConvertDescPssh<true>
	& ConvertDescPiff<true>
	& (
		| (
			& ConvertDescDirect<true, true>
			& ConvertDescEmitMpd<false, true>
		)
		| (
			& ConvertDescDirect<true, false>
			& ConvertDescEmitMpd<false, false>
		)
	)
	& ConvertDescSkipPreprocess<true>
);

/** `ConvertDescription` 型のうち、 `Tool.MP4Box` が指定された場合を取り扱う型 */
export type ConvertDescriptionMP4Box = (
	& ConvertDescTool<typeof Tool.MP4Box>
	& ConvertDescRunMode<true>
	& ConvertDescContainerCodecMP4Only
	& ConvertDescPssh<true>
	& ConvertDescPiff<true>
	& ConvertDescDirect<true>
	& ConvertDescSkipPreprocess<true>
	& ConvertDescEmitMpd<true>
);

/** `ConvertDescription` 型のうち、 `Tool.GPAC` が指定された場合を取り扱う型 */
export type ConvertDescriptionGpac = (
	& ConvertDescTool<typeof Tool.GPAC>
	& (
		| (
			& ConvertDescContainerCodec<typeof Container.MP4>
			& ConvertDescRunMode<true>
		)
		// WebM の暗号化は非サポート
		| (
			& ConvertDescContainerCodec<typeof Container.WebM>
			& ConvertDescRunMode<false>
		)
	)
	& ConvertDescPssh<true>
	& ConvertDescPiff<true>
	& ConvertDescDirect<true>
	& ConvertDescSkipPreprocess<true>
	& ConvertDescEmitMpd<true>
);

/** `ConvertDescription` 型のうち、 `Tool.ShakaPackager` が指定された場合を取り扱う型 */
export type ConvertDescriptionShakaPackager = (
	& ConvertDescTool<typeof Tool.ShakaPackager>
	& ConvertDescRunMode<true>
	& ConvertDescContainerCodec
	& ConvertDescPssh<true>
	& ConvertDescPiff<false>
	& ConvertDescDirect<false>
	& ConvertDescSkipPreprocess<true>
	& ConvertDescEmitMpd<true>
);

/** 動画の変換に使用するツールを示す型 */
export namespace Tool {
	/** 完全に FFmpeg を使って暗号化やセグメント分割まで行う */
	export const FFmpeg = "ffmpeg";
	/** Bento4 (`mp4fragment`, `mp4split`, `mp4encrypt`, `mp4dash`) をセグメント分割や暗号化に使用する */
	export const Bento4 = "bento4";
	/** GPAC (`MP4Box`) をセグメント分割や暗号化に使用する */
	export const MP4Box = "mp4box";
	/** GPAC (`gpac`) をセグメント分割や暗号化に使用する */
	export const GPAC = "gpac";
	/** Shaka Packager (`packager`) をセグメント分割や暗号化に使用する */
	export const ShakaPackager = "shaka";

	/** 動画の変換に使用するツールを示す型 */
	export type Type = typeof FFmpeg | typeof Bento4 | typeof MP4Box | typeof GPAC | typeof ShakaPackager;
}

/** `ConvertDescription` 型のうち、 `tool` プロパティを制御する型 */
type ConvertDescTool<T extends Tool.Type = Tool.Type> = {
	/**
	 * 動画の変換に使用するツールを指定する
	 *
	 * 以下の値が指定できます
	 * * `Tool.FFmpeg` / `"ffmpeg"`
	 * 	* 完全に FFmpeg を使って暗号化やセグメント分割まで行う。 FFmpeg での暗号化やセグメント分割は機能が制限されているので、通常はおすすめされない。
	 * * `Tool.Bento4` / `"bento4"`
	 * 	* Bento4 (`mp4fragment`, `mp4split`, `mp4encrypt`, `mp4dash`) をセグメント分割や暗号化に使用する。 MP4 コンテナの場合にはこのツールが最もよく機能します。但し最初の GOP 処理では FFmpeg を利用しない。
	 * * `Tool.MP4Box` / `"mp4box"`
	 * 	* GPAC (`MP4Box`) をセグメント分割や暗号化に使用する。 MP4 コンテナではこちらもよくセグメント分割や暗号化に使われています。但し最初の GOP 処理では FFmpeg を利用しない。
	 * * `Tool.GPAC` / `"gpac"`
	 * 	* GPAC (`gpac`) をセグメント分割や暗号化に使用する。 MP4 コンテナではこちらもよくセグメント分割や暗号化に使われています。但し最初の GOP 処理では FFmpeg を利用しない。
	 * * `Tool.ShakaPackager` / `"shaka"`
	 * 	* Shaka Packager (`packager`) をセグメント分割や暗号化に使用する。 MP4 と WebM コンテナのセグメント分割や暗号化ができます。但し最初の GOP 処理では FFmpeg を利用しない。
	 */
	tool: T;
};

/** 動画変換の実行モードを示す型 */
export namespace RunMode {
	/** MSE に対応できるよう、セグメント分けを実行する */
	export const MSE = "mse";
	/** MSE と EME に対応できるよう、セグメント分けと暗号化を実行する */
	export const MSE_EME = "mse+eme";
	/** EME に対応できるよう、暗号化を実行する */
	export const EME = "eme";

	/** 動画変換の実行モードを示す型 */
	export type Type = typeof MSE | typeof MSE_EME | typeof EME;
}

type ConvertDescRunMode<AllowEme extends boolean> = (
	AllowEme extends true ? {
		/**
		 * 動画変換の実行モードを設定する
		 *
		 * 以下の値が指定できます
		 * * `RunMode.MSE` / `"mse"`
		 * 	* MSE に対応できるよう、セグメント分けを実行する
		 * * `RunMode.MSE_EME` / `"mse+eme"`
		 * 	* MSE と EME に対応できるよう、セグメント分けと暗号化を実行する
		 * * `RunMode.EME` / `"eme"`
		 * 	* EME に対応できるよう、暗号化を実行する (ブラウザでは通常再生できない)
		 */
		runMode: RunMode.Type;
	} : {
		/**
		 * 動画変換の実行モードを設定する
		 *
		 * 以下の値が指定できます
		 * * `RunMode.MSE` / `"mse"`
		 * 	* MSE に対応できるよう、セグメント分けを実行する
		 * * `RunMode.MSE_EME` / `"mse+eme"`
		 * 	* MSE と EME に対応できるよう、セグメント分けと暗号化を実行する
		 * * `RunMode.EME` / `"eme"`
		 * 	* EME に対応できるよう、暗号化を実行する (ブラウザでは通常再生できない)
		 *
		 * **FFmpeg, GPAC の WebM 出力では暗号化に対応していない**
		 */
		runMode?: typeof RunMode.MSE;
	}
);

/** `ConvertDescContainer` と `ConvertDescCodec` を結合した型 */
type ConvertDescContainerCodec<T extends Container.Type = Container.Type> = (
	Container.Type extends T ? (
		| (
			& ConvertDescContainer<typeof Container.MP4>
			& ConvertDescCodec<typeof Container.MP4>
		)
		| (
			& ConvertDescContainer<typeof Container.WebM>
			& ConvertDescCodec<typeof Container.WebM>
		)
	) : (
		& ConvertDescContainer<T>
		& ConvertDescCodec<T>
	)
);

/**
 * `ConvertDescription` 型のうち、 `container`, `codec` プロパティを制御する型
 *
 * `ConvertDescContainerCodec` とは違い、 MP4 限定である場合に使用する
 */
type ConvertDescContainerCodecMP4Only = {
	/**
	 * 動画の変換先のコンテナを指定する
	 *
	 * 以下の値が指定できる
	 * * `Container.MP4` / `"mp4"`
	 * 	* MP4 コンテナを使用する
	 * * `Container.WebM` / `"webm"`
	 * 	* WebM コンテナを使用する
	 *
	 * **このツールでの書き出し可能なコンテナは MP4 に制限する**
	 */
	container?: typeof Container.MP4;
} & ConvertDescCodec<typeof Container.MP4>;

/** 動画の変換先のコンテナを示す型 */
export namespace Container {
	/** MP4 コンテナを使用する */
	export const MP4 = "mp4";
	/** WebM コンテナを使用する */
	export const WebM = "webm";

	/** 動画の変換先のコンテナを示す型 */
	export type Type = typeof MP4 | typeof WebM;
}

/** `ConvertDescription` 型のうち、 `container` プロパティを制御する型 */
type ConvertDescContainer<T extends Container.Type> = {
	/**
	 * 動画の変換先のコンテナを指定する
	 *
	 * 以下の値が指定できる
	 * * `Container.MP4` / `"mp4"`
	 * 	* MP4 コンテナを使用する
	 * * `Container.WebM` / `"webm"`
	 * 	* WebM コンテナを使用する
	 */
	container: T;
};

/** 変換後のビデオコーデックを示す型 */
export namespace VideoCodec {
	/** H.264 (AVC) 形式 */
	export const H264 = "h264";
	/** H.265 (HEVC) 形式 */
	export const H265 = "h265";
	/** VP9 形式 */
	export const VP9 = "vp9";
	/** AV1 形式 */
	export const AV1 = "av1";
	/** VP8 形式 */
	export const VP8 = "vp8";

	/** `VideoCodec` の全ての値 */
	export const all = [H264, H265, VP9, AV1, VP8] as const;

	/**
	 * 変換後のビデオコーデックを示す型
	 *
	 * とりわけ `container === Container.MP4` の場合に指定可能な型のみ含まれている
	 */
	export type MP4Type = typeof H264 | typeof H265 | typeof VP9 | typeof AV1 | typeof VP8;
	/**
	 * 変換後のビデオコーデックを示す型
	 *
	 * とりわけ `container === Container.WebM` の場合に指定可能な型のみ含まれている
	 */
	export type WebMType = typeof VP9 | typeof AV1 | typeof VP8;
	/** 変換後のビデオコーデックを示す型 */
	export type Type = MP4Type | WebMType;
}

/** 変換後のオーディオコーデックを示す型 */
export namespace AudioCodec {
	/** AAC 形式 */
	export const AAC = "aac";
	/** AC-3 形式 */
	export const AC3 = "ac3";
	/** E-AC-3 形式 */
	export const EAC3 = "eac3";
	/** DTS DCA 形式 */
	export const DTS = "dts";
	/** Opus 形式 */
	export const Opus = "opus";
	/** Vorbis 形式 */
	export const Vorbis = "vorbis";

	/**
	 * 変換後のオーディオコーデックを示す型
	 *
	 * とりわけ `container === Container.MP4` の場合に指定可能な型のみ含まれている
	 */
	export type MP4Type = typeof AAC | typeof AC3 | typeof EAC3 | typeof DTS;
	/**
	 * 変換後のオーディオコーデックを示す型
	 *
	 * とりわけ `container === Container.WebM` の場合に指定可能な型のみ含まれている
	 */
	export type WebMType = typeof Opus | typeof Vorbis;
	/** 変換後のオーディオコーデックを示す型 */
	export type Type = MP4Type | WebMType;
}

/** `ConvertDescription` 型のうち、 `codec` プロパティを制御する型 */
type ConvertDescCodec<T extends Container.Type> = (
	Container.Type extends T ? never :
	T extends typeof Container.MP4 ? {
		/**
		 * 変換後のビデオコーデックを指定する
		 *
	   * 以下の値が指定できる
		 * * `VideoCodec.H264` / `"h264"`
		 * 	* H.264 (AVC) 形式
		 * * `VideoCodec.H265` / `"h265"`
		 * 	* H.265 (HEVC) 形式
		 * * `VideoCodec.VP8` / `"vp8"`
		 * 	* VP8 形式
		 * * `VideoCodec.VP9` / `"vp9"`
		 * 	* VP9 形式
		 * * `VideoCodec.AV1` / `"av1"`
		 * 	* AV1 形式
		 */
		videoCodec: VideoCodec.MP4Type;
		/**
		 * 変換後のオーディオコーデックを指定する
		 *
	   * 以下の値が指定できる
		 * * `VideoCodec.AAC` / `"aac"`
		 * 	* AAC 形式
		 * * `VideoCodec.AC3` / `"ac3"`
		 * 	* AC-3 形式
		 * * `VideoCodec.EAC3` / `"eac3"`
		 * 	* E-AC-3 形式
		 * * `VideoCodec.DTS` / `"dts"`
		 * 	* DTS 形式
		 */
		audioCodec: AudioCodec.MP4Type;
	} :
	T extends typeof Container.WebM ? {
		/**
		 * 変換後のビデオコーデックを指定する
		 *
	   * 以下の値が指定できる
		 * * `VideoCodec.H264` / `"h264"`
		 * 	* H.264 (AVC) 形式
		 * * `VideoCodec.H265` / `"h265"`
		 * 	* H.265 (HEVC) 形式
		 * * `VideoCodec.VP8` / `"vp8"`
		 * 	* VP8 形式
		 * * `VideoCodec.VP9` / `"vp9"`
		 * 	* VP9 形式
		 * * `VideoCodec.AV1` / `"av1"`
		 * 	* AV1 形式
		 */
		videoCodec: VideoCodec.WebMType;
		/**
		 * 変換後のオーディオコーデックを指定する
		 *
	   * 以下の値が指定できる
		 * * `AudioCodec.Opus` / `"opus"`
		 * 	* Opus 形式
		 * * `AudioCodec.Vorbis` / `"vorbis"`
		 * 	* Vorbis 形式
		 */
		audioCodec: AudioCodec.WebMType;
	} :
	never
);

/** `ConvertDescription` 型のうち、 `pssh` プロパティを制御する型 */
type ConvertDescPssh<Settable extends boolean> = (
	Settable extends true ? {
		/**
		 * コンテナに PSSH データを付加するかどうかを設定する。 PSSH を設定すると EME で正常に再生できる可能性が高くなる。
		 */
		pssh?: boolean;
	} : {
		/**
		 * コンテナに PSSH データを付加するかどうかを設定する。 PSSH を設定すると EME で正常に再生できる可能性が高くなる。
		 *
		 * FFmpeg では PSSH データを付加することはサポートされていない
		 */
		pssh?: false;

	}
);

/** `ConvertDescription` 型のうち、 `pssh` プロパティを制御する型 */
type ConvertDescPiff<Settable extends boolean> = (
	Settable extends true ? {
		/**
		 * コンテナに PIFF データを付加するかどうかを設定する。 PIFF は PlayReady 互換の形式である。
		 */
		piff?: boolean;
	} : {
		/**
		 * コンテナに PIFF データを付加するかどうかを設定する。 PIFF は PlayReady 互換の形式である。
		 *
		 * **PIFF 付加は Bento4 でのみサポートされている**
		 */
		piff?: false;
	}
);

/** `ConvertDescription` 型のうち、 `direct` プロパティを制御する型 */
type ConvertDescDirect<Settable extends boolean, T extends boolean = boolean> = (
	Settable extends true ? {
		/**
		 * 実行方式を指定する
		 *
		 * * `false` (既定値) に設定するとフラグメント化、セグメント化、暗号化が1つ1つ別々のコマンドとして実行され、途中の中間生成物も発生する。
		 * * `true` に設定すると、プリプロセスを除きなるべく途中で区切ることなく一気に最終出力まで少ないのコマンドで実行する。一部のツールは一回のコマンドで完了する。
		 */
		direct?: T;
	} : {
		/**
		 * 実行方式を指定する
		 *
		 * * `false` (既定値) に設定するとフラグメント化、セグメント化、暗号化が1つ1つ別々のコマンドとして実行され、途中の中間生成物も発生する。
		 * * `true` に設定すると、プリプロセスを除きなるべく途中で区切ることなく一気に最終出力まで少ないのコマンドで実行する。一部のツールは一回のコマンドで完了する。
		 *
		 * **このツールでは少ないコマンドで実行する処理には対応していない**
		 */
		direct?: false;
	}
);

/** `ConvertDescription` 型のうち、 `skipPreprocess` プロパティを制御する型 */
type ConvertDescSkipPreprocess<Settable extends boolean> = (
	Settable extends true ? {
		/**
		 * プリプロセス処理をスキップするか否かを指定する
		 *
		 * この設定をオンにすると既にプリプロセス処理を行っている場合に、前回の結果を再活用することができる
		 */
		skipPreprocess?: boolean;
	} : {
		/**
		 * プリプロセス処理をスキップするか否かを指定する
		 *
		 * この設定をオンにすると既にプリプロセス処理を行っている場合に、前回の結果を再活用することができる
		 *
		 * **現在の設定ではスキップ機能を有効化することはできない**
		 */
		skipPreprocess?: false;
	}
);

/** `ConvertDescription` 型のうち、 `emitMpd` プロパティを制御する型 */
type ConvertDescEmitMpd<Settable extends boolean, T extends boolean = boolean> = (
	Settable extends true ? {
		/** DASH で使用される MPD ファイルを出力するか否か設定する */
		emitMpd?: boolean;
	} : {
		/**
		 * DASH で使用される MPD ファイルを出力するか否か設定する
		 *
		 * **このツールでは現在の設定を変更することはできない**
		 */
		emitMpd?: T;
	}
);