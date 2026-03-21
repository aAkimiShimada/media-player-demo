// このファイルでは暗号化関連のいくつかの型が定義されている

/** 暗号化キーのペアを表す型 */
export interface KeyPair {
	/** 16進数の形で指定されたキーID */
	keyId: string;
	/** 16進数の形で指定されたキー */
	key: string;
};

/**
 * 暗号化キーを規定する型
 *
 * 映像部分と音声部分で別々にキーペアが指定できるようになっている。 (以後の実装を見ると明らかだが、映像と音声を逆に指定しても特に問題は発生しない)
 */
export interface EncryptionKeys {
	/** 映像部分の暗号化キーペア */
	video: KeyPair;
	/** 音声部分の暗号化キーペア */
	audio: KeyPair;
};