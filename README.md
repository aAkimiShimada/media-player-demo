media-player-demo
---

ストリーミングに MSE API を、暗号化した動画の再生に EME API (Clear Key キーシステム) を使った簡単な動画配信サーバと動画プレーヤーを実装しています。

## 特徴

* MSE API や EME API を使ってブラウザ上でストリーミングや暗号化した動画を再生するための実装が用意されています。
	* ストリーミングの方は動画プレーヤーの操作に応じて適切なセグメントが取得できるように多少工夫されています。
	* ソースコード中のフラグを切り替えるだけで MSE の機能を利用するか否か、 EME の機能を利用するか否かが簡単に切り替えられます。
		* 簡単に切り替えられるようにコードが機能ごとに集約されています。
	* ストリーミングの再生状況が表示されるパネルの UI が用意されています。 MSE API を有効にするとこの機能にアクセスできます。
	* MSE API や EME API の機能の利用状況が事細かにログに出力されます。
	* スクリプティングは TypeScript で書かれており、これをトランスパイルすることでブラウザで実行可能な JavaScript にします。
		* しかもトランスパイルにおいて、 TypeScript のコード構造をなるべく崩さないように (= minify しないように) 変換しているので、 TypeScript でも JavaScript でもコードが見やすい状態で編集できるようになっています。
		* Babel のトランスパイラで TypeScript から JavaScript への変換を行っていますが、それだけでは不完全なので、トランスパイル後の JavaScript コードを適切に修正するスクリプトも含まれており、これが実行されます。
* ストリーミング (MSE API) のためのセグメントに分かれた動画や、暗号化した動画 (EME API) の生成を行うためのスクリプトが用意されています。
	* ストリーミングの有無や、暗号化の有無に合わせて、スクリプトの処理内容を切り替えて実行できるようになっています。
	* 動画ファイルの長さや暗号化キーなど、スクリプトの依存するパラメータは1つのファイルにまとめられています。
	* セグメント分割や暗号化には CLI ツールを使用しますが、複数のツールに対応しており、使用するツールを選択できるようになっています。
* Express により構築された簡易的なサーバープログラムが用意されています。
	* 通信環境が悪化した状況をエミュレーションするための機能も備えています。
* 全体的にソースコードは内容が理解しやすくなるように整頓され、コメントが適宜追加されています。
* ブラウザ上で動作するJSコードや、動画生成スクリプト、サーバ起動のコードはどれも TypeScript で書かれています。
* **ソースコードはかなり歯抜け状態になっており、そのままでは動作しないようになっています。**
	* 使用する動画素材によってパラメータが異なることと、考えて埋めていくことで仕組みが理解ができるように作られています。
	* 一応解答例を `answer` ブランチに挙げています。

## 必要なもの

### ソフトウェア

* Node.js  
	このリポジトリは NPM パッケージになっています。
* FFmpeg
* セグメント分割や暗号化には以下のツールのうち最低どれか1つは必要です (複数インストールしていても良い)
	* Shaka Packager
	* Bento4
	* GPAC
* 最新のブラウザ  
	* Chromium 系 or Firefox で動作します。
	* Safari だと Clear Key キーシステムに対応していないため、 EME API の動作テストができません。

### コンテンツ

* 動画ファイル
	* 映像と音声が両方含まれているもの
		* 処理に時間がかかるので、あまり再生時間が長くない動画を選択するのが良いです
		* ブラウザで再生したり、 FFmpeg で変換したりするので、ブラウザが対応しているかつ FFmpeg で取り扱うことのできるコーデックやコンテナであることが望ましいです
	* 動画ファイルの長さは特に指定しませんが、用いる動画ファイルの長さに合わせて `ts_src/consts.ts` と `scripts/converter/consts.ts` の両方の値を適切に書き換える必要があります。

### ソフトウェアのインストール

上記の必要なソフトウェアをインストールする手段を以下に説明します。

#### FFmpeg

パッケージマネージャで標準的に用意されているバイナリだとここで必要な作業ができない可能性が高いです。なのでソースコードからビルドする必要があります。

##### Homebrew

macOS の場合は Homebrew から入手できます。  
しかし、 `brew install ffmpeg` で入手可能な FFmpeg では libfreetype が無効化されているためここでは使用できません。  
以下のように[コミュニティが提供している tap](https://github.com/homebrew-ffmpeg/homebrew-ffmpeg) を利用してインストールしてください。

```shell
brew tap homebrew-ffmpeg/ffmpeg
brew install homebrew-ffmpeg/ffmpeg/ffmpeg
```

* `brew install ffmpeg` ではビルド済みのバイナリを取得してインストールするだけでしたが、こちらはソースコードからビルドを実行します。なのでインストールには若干時間がかかります。
* FFmpeg で利用する機能をカスタマイズすることもできます。[公式ドキュメントに従ってオプションを指定して](https://github.com/homebrew-ffmpeg/homebrew-ffmpeg/blob/master/README.md#included-libraries)実行してください。依存するライブラリも自動的にインストールされます。
* Linux でも一応上記の方法で Linuxbrew より入手できますが、ビルドが途中で失敗する可能性があります。

##### ソースコードからビルド

[FFmpeg のリポジトリ](https://github.com/ffmpeg/ffmpeg)をクローンしてビルドを実行します。

* 基本的には [FFmpeg 公式ドキュメント](https://trac.ffmpeg.org/wiki/CompilationGuide)に記載された手順に従えば用意できます。
* `--enable-*` や `--disable-*` の形式のオプションを指定することで、ライブラリに依存する各種機能を有効化/無効化できます。指定可能なオプションは [`configure` のヘルプ](https://github.com/FFmpeg/FFmpeg/blob/master/configure#L183-L375) を参照します。

#### Shaka Packager

Shaka Packager は公式のリリースバイナリを使用するのが最もお手軽です。

##### バイナリのダウンロード&インストール

[公式リポジトリの最新リリース](https://github.com/shaka-project/shaka-packager/releases)を入手します。  
それぞれの OS でビルド済バイナリの形式で提供されているので、ダウンロードをした後、実行権限を与えて `PATH` の通っているディレクトリに移動させます。

##### Homebrew からインストール

個人で開発されている tap からインストールすることもできます。  
ソースコードを見る限り、やっていることとしては上記の公式リリースバイナリをインストールしているだけです。

```shell
brew tap garnajee/perso
brew install garnajee/perso/shaka-packager
```

Linux では動作しないようです。

#### Bento4

##### Homebrew

Homebrew の場合は簡単にインストールできます。

```shell
brew install bento4
```

#### GPAC

##### Homebrew

Homebrew の場合は簡単にインストールできます。

```shell
brew install gpac
```

ただこれだと依存関係として通常の FFmpeg が求められて、インストールに失敗してしまうことがあります。  
その場合は以下のようにして FFmpeg 以外の依存関係のみをインストールするようにしてください。
(依存関係が手動インストールした扱いになりますが、これは避けられない)

```shell
brew install --ignore-dependencies gpac && \
brew install $(brew deps gpac | grep -v ffmpeg)
```

## 基本的な使い方

まず最初に必要なパッケージをインストールしてください。

```shell
npm install
```

### 流れ

以下の流れで操作することになると思われます。

1. 対象となる動画ファイルを用意する。
2. 動画の変換スクリプトを書き換えて実行する。
3. フロントエンド TypeScript を編集する。
4. フロントエンド TypeScript をトランスパイルする。
5. サーバーを起動する。
6. ブラウザで Web ページを表示する。

### 動画の変換

予め対象の動画ファイルを `media` に移動します。  
デフォルトでは `media/movie.mp4` に配置することで機能するようになっていますが、後述する設定を変えることで他のファイル名に設定することもできます。

```
mv /path/to/movie.mp4 media/movie.mp4
```

そして変換は以下のコマンドから行えます。

```shell
npm run convert
```

これでストリーミング向けにセグメント分割されたメディアデータが作成されます。

### フロントエンドのトランスパイル

フロントエンドの TypeScript コードは以下のコマンドにより JavaScript に変換できます。

```shell
npm run build
```

### サーバーの起動

サーバーの起動は以下のコマンドから行えます。

```shell
npm run serve
```

通信環境が悪化したり改善したりする状況をエミュレーションするサーバを起動するのは以下のコマンドから行えます。

```shell
npm run serve-throttling
```

## 作業手順

初期状態ではストリーミングや暗号化は無効化されています。なのでこれらの機能を試すには手動でコードに含まれる設定用の変数を書き換える必要があります。

### ストリーミングを有効化する手順


1. 対象とする動画ファイルを `media` 以下に置く (以下は `movie.mp4` の例)

	```shell
	mv /path/to/your-movie.mp4 media/movie.mp4
	```

	`movie.mp4` の場合はこの時点で `npm run server` でサーバーを起動すると初期状態でストリーミングを行わずに動画を再生するようになっています。

2. 動画ファイルをセグメントで分割した形に変換する  
	生成したセグメントは `media/segments` ディレクトリ内に保存されます。

	```shell
	npm run convert
	```

3. `index.html` を開き、 `video` 要素に含まれる `source` 要素を消します。

	```diff
	   <body>
	     <video controls>
	-      <source src="media/movie.mp4" type="video/mp4" />
	     </video>
	   </body>
	 </html>
	```

4. `ts_src/consts.ts` を開き、 3. で生成したセグメントが読み込まれるようにパスを指定する  
	以下の `getVideoSegmentUrl` と `getAudioSegmentUrl` はそれぞれ要求された解像度やセグメントの情報から、適切なセグメントのパスを返すことを期待される関数です。 3. で生成されたセグメントを確認して適切なパスを返すように書いてください。  
	`segmentIndex` として `-1` が渡された場合は初期セグメント `init.mp4` が渡されることが期待され、 `0` より大きな値ではセグメント本体 `seg-*.m4s` が返されることが期待されます。

	```typescript
	const getVideoSegmentUrl = (
	  // 解像度番号 (1, 2, 3, 4, 5)
	  resIndex: number,    
	  // セグメント番号 (-1, 0, 1, 2, …)
	  segmentIndex: number
	): string => {
	  // TODO: これから実装する
	  return "";
	};
	
	const getAudioSegmentUrl = (
	  // セグメント番号 (-1, 0, 1, 2, …)
	  segmentIndex: number
	): string => {
	  // TODO: これから実装する
	  return "";
	};
	```

5. `ts_src/consts.ts` で MSE の機能を有効化する  
	単純にブール値 `enableMSE` を `true` に設定するだけで使用できるようになります。

	```diff
	 /** MSE API の機能の有効/無効を切り替える */
	-export const enableMSE: boolean = false;
	+export const enableMSE: boolean = true;
	 
	 /** EME API の機能の有効/無効を切り替える */
	 export const enableEME: boolean = false;
	 
	 /** 解像度の「自動」設定の有効/無効を切り替える */
	 export const enableAutoResolution: boolean = false;
	```

6. トランスパイルの実行

	```shell
	npm run build
	```

7. サーバーを起動  
	既にこのコマンドでサーバーを起動している場合は、新たに行う操作はありません。

	```shell
	npm run serve
	```

8. ブラウザで再読み込みすることでストリーミングを使った動画プレーヤーが利用できるようになります。

### 暗号化を有効化する手順

※ 以下の手順は既に上記の「ストリーミングを有効化する手順」を実行していることを前提としています。

1. 暗号化に使用する鍵を作成する  
	16進数で32桁の文字列を4つ用意します。

	```shell
	openssl rand -hex 16
	openssl rand -hex 16
	openssl rand -hex 16
	openssl rand -hex 16
	```

2. 暗号化した動画セグメントを生成するにあたり、 1. で用意した暗号化鍵を変換スクリプトの `scripts/converter/consts.ts` の変数 `encryptionKeys` にセットします。  
	4種類のキーは 映像の `keyId` と `key` 、音声の `keyId` と `key` にそれぞれ割り当てます。

	```diff
	 /** 暗号化キーの設定 */
	 export const encryptionKeys: EncryptionKeys = {
	   video: {
	-    keyId: "",
	-    key: ""
	+    keyId: "映像の keyId をここにセットします",
	+    key: "映像の key をここにセットします"
	   },
	   audio: {
	-    keyId: "",
	-    key: ""
	+    keyId: "音声の keyId をここにセットします",
	+    key: "音声の key をここにセットします"
	   }
	 };
	```

3. `scripts/converter/consts.ts` を開き、暗号化した動画セグメントが生成されるように処理モードを変更します。  
	`convertDescription` オブジェクトの `runMode` の値によって処理モードが切り替わります。  
	標準では `"mse"` に設定されており、暗号化していないセグメントを生成されます。 `"mse+eme"` に設定することで暗号化したセグメントが再生されるようになります。  
	さらに `skipPreprocess` に対して `true` を指定することで「ストリーミングを有効化する手順」でセグメント生成に使用した中間生成ファイル (`media/intermediates`) を再利用し、処理時間が削減されます。

	```diff
	 export const convertDescription: ConvertDescription = {
	 	tool: "shaka",
	-	runMode: "mse",
	+	runMode: "mse+eme",
	-	skipPreprocess: false,
	+	skipPreprocess: true,
	 	container: "mp4",
	 	videoCodec: "h264",
	 	audioCodec: "aac",
	 	pssh: true,
	 	piff: false,
	 	direct: false,
	 	emitMpd: false,
	 };
	```

4. 暗号化したセグメント生成処理を実行します。  
	上記のステップ 2., 3. により暗号化したセグメントを生成する準備は整っています。  
	生成したセグメントは `media/segments` の代わりに `media/segments_encrypted` に保存されます。  
	`segments_encrypted` 内のファイルツリー構造は `segments` と同じです。

	```shell
	npm run convert
	```

5. フロントエンド実装の `ts_src/consts.ts` を開き、関数 `getVideoSegmentUrl` と `getAudioSegmentUrl` のパスを書き換えます。  
	セグメントが保存される場所が変更されたので、以下のパス例のように適切なパスが返されるように関数の実装を変更する必要があります。  
	単純に `segments` を `segments_encrypted` に書き換えるだけで問題ありません。

	```diff
	- media/segments/video_1/seg-10.m4s
	+ media/segments_encrypted/video_1/seg-10.m4s
	```

6. `ts_src/consts.ts` を開き、ステップ 2. と同様に変数 `encryptionKeys` に暗号化鍵をセットします。

	```diff
	 /** 暗号化キー */
	 export const encryptionKeys: EncryptionKeys = {
	   video: {
	-    keyId: "",
	-    key: ""
	+    keyId: "映像の keyId をここにセットします",
	+    key: "映像の key をここにセットします"
	   },
	   audio: {
	-    keyId: "",
	-    key: ""
	+    keyId: "音声の keyId をここにセットします",
	+    key: "音声の key をここにセットします"
	   }
	 };
	```

7. `ts_src/consts.ts` を開き EME の機能を有効化する  
	単純にブール値 `enableEME` を `true` に設定するだけで使用できるようになります。

	```diff
	 /** MSE API の機能の有効/無効を切り替える */
	 export const enableMSE: boolean = true;
	 
	 /** EME API の機能の有効/無効を切り替える */
	-export const enableEME: boolean = false;
	+export const enableEME: boolean = true;
	 
	 /** 解像度の「自動」設定の有効/無効を切り替える */
	 export const enableAutoResolution: boolean = false;
	```

8. トランスパイルの実行

	```shell
	npm run build
	```

9. サーバーを起動  
	既にこのコマンドでサーバーを起動している場合は、新たに行う操作はありません。

	```shell
	npm run serve
	```

10. ブラウザで再読み込みすることで暗号化した動画に対するストリーミングを使った動画プレーヤーが利用できるようになります。

### 解像度の「自動」モードを有効化する手順

アダプティブストリーミングの簡単な例として、解像度を自動で変更する機能が試せるようになっています。  
動画コンバートなどでは新たに行う操作はありません。  
※ 以下の手順は既に上記の「ストリーミングを有効化する手順」を実行していることを前提としています。

1. `ts_src/consts.ts` を開き、関数 `getOptimalResolution` で解像度を適切に返す実装を行います。  
	この関数は解像度変更が必要になった場合に、現在の再生状況をオブジェクトとして渡したときに、そのデータに基づき最適な解像度番号が返されることが期待されます。

	```typescript
	const getOptimalResolution = (
	  // 再生状況を表すオブジェクト
	  playerState: PlayerState
	): number => {
	  // TODO: これから実装する
	  return 1;
	  // 選択する解像度番号 (1, 2, 3, 4, 5) を返す
	  // 1: 低解像度  ~  5: 高解像度
	};
	```

	引数のオブジェクト `playerState` は以下の仕様になっています。

	```typescript
	interface PlayerState {
	  // 現在の再生位置 (秒)
	  currentTime: number;
	  // 最後に読み込みが完了したセグメントのインデクス番号
	  lastLoadedSegmentIndex: number;
	  // 次に読み込む予定のセグメントのインデクス番号
	  nextLoadingSegmentIndex: number;
	  // 現在の解像度設定
	  // 未定の場合は `null` になる
	  resolution: Resolution | null;
	  // オフライン扱いをするかどうか
	  // セグメントの取得が滞るとオフラインと判定する
	  isOffline: boolean;
	};
	```

2. `ts_src/consts.ts` を開き、自動解像度の機能を有効化します。  
	単純にブール値 `enableEME` を `true` に設定するだけで使用できるようになります。

	```diff
	 /** MSE API の機能の有効/無効を切り替える */
	 export const enableMSE: boolean = true;
	 
	 /** EME API の機能の有効/無効を切り替える */
	 export const enableEME: boolean = true;
	 
	 /** 解像度の「自動」設定の有効/無効を切り替える */
	-export const enableAutoResolution: boolean = false;
	+export const enableAutoResolution: boolean = true;
	```

3. トランスパイルの実行

	```shell
	npm run build
	```

4. サーバーを起動  
	既にこのコマンドでサーバーを起動している場合は、新たに行う操作はありません。

	```shell
	npm run serve
	```

5. ブラウザで再読み込みすることで、解像度として「自動」が選択できるようになった動画プレーヤーが利用できるようになります。

## 動画の変換処理

`npm run convert` で作動する変換処理では以下の処理が実行されます。

1. 事前処理 (プリプロセス)  
	元の単一の動画ファイルに対して以下の処理が実行されます。

	* 映像の左上に再生時刻を表すテキストが表記される
	* 映像のみ、音声のみを取り出してファイルにする
	* 映像は複数の解像度に分けて出力される (音声は単一データを使う)
	* 所定のコーデックでエンコードする

	これらの操作は常に FFmpeg を使用して行われます。
2. 本処理  
	ストリーミングや DRM 対応のために以下の操作を行います。

	* フラグメント化、セグメントによる分割
	* 暗号化

	これらの操作を行うツールは複数あり、使用するツールを選択することができます。

## ディレクトリ構成

* `package.json`  
	NPM パッケージの情報が書かれています。
* `babel.config.json`  
	トランスパイルに使用する Babel の設定が書かれています。
* `tsconfig.json`  
	TypeScript の設定が書かれています。  
	ただし実際には `tsconfig*.json` で設定の詳細を書いています。
* `.editorconfig`  
	EditorConfig を使ったエディタ設定を記載しています。
* `tsconfig.web.json`  
	フロントエンドの TypeScript コードの設定が書かれています。
* `index.html`  
	フロントエンドの HTML ページです。
* `resources`  
	画像やスタイルシートが含まれています。
* `js_src`  
	フロントエンドで実行される JavaScript コードが含まれています。  
	モジュール形式でインポートされます。
* `ts_src`  
	フロントエンドの JavaScript に対応する TypeScript コードです。  
	トランスパイルして `js_src` に保存されます。
* `scripts`  
	各種スクリプトファイルが保存されたディレクトリです。
	* `clean_files.ts`  
		トランスパイル時に生成される JavaScript コードを少し修正するためのスクリプトです。
	* `server.ts`  
		サーバーを起動させるスクリプトです。
	* `converter`  
		動画変換の処理を行うスクリプトがまとめられたディレクトリです。詳しくはこの後のセクションで説明します。
	* `lib`  
		スクリプトファイルで共有して利用するツールがまとめられたディレクトリです。
	* `tsconfig.*.json`  
		それぞれのスクリプトに対応する TypeScript コードの設定が書かれています。
* `media`  
	動画ファイルが保存されるディレクトリです。
	* `movie.mp4`  
		元となる変換前の動画ファイルです。
	* `segments`  
		MSE のみを使用する場合のセグメントに分かれた動画ファイルはこの名前のディレクトリに保存されます。
	* `segments_encrypted`  
		MSE + EME を使用する場合のセグメントに分かれた暗号化した動画ファイルはこの名前のディレクトリに保存されます。
	* `encrypted.mp4`  
		EME のみを使用する場合の暗号化した動画ファイルはこのファイル名で保存されます。
	* `intermediates`  
		変換スクリプトを実行途中に出力される中間生成ファイルが保存されるディレクトリです。  
		このディレクトリを消さずに残しておくと、次の変換操作の時にキャッシュとなって処理内容を減らせます。

## 設定の変え方

設定項目は2つの `consts.ts` に集約しています。これらにある変数値を変えることで基本的な設定変更はできるようになっています。

| | |
|:--|:--|
| `scripts/converter/consts.ts` | 動画の変換処理に関する設定が記載されたファイル |
| `ts_src/consts.ts` | ブラウザ上で表示する動画プレーヤーの設定が記載されたファイル |

こちらを書き換えることで設定変更できるようになっています。以下に設定可能な項目を挙げています。

### 動画コンバーターの設定 (`scripts/converter/consts.ts`)

#### 処理内容の指定

先頭に用意されている `convertDescription` を書き換えることにより処理内容を変更することができます。

```typescript
export const convertDescription: ConvertDescription = {
	tool: "shaka",
	runMode: "mse",
	skipPreprocess: false,
	container: "mp4",
	videoCodec: "h264",
	audioCodec: "aac",
	pssh: true,
	piff: false,
	direct: false,
	emitMpd: false,
};
```

##### `tool`

動画の変換に使用するツールを指定します。  
以下の値から指定できます。  
いずれの場合も事前処理 (プリプロセス) には FFmpeg を使用します。

| 指定値 | 説明 |
|:--:|:--|
| `"ffmpeg"` | 本処理でも FFmpeg を使用する |
| `"bento4"` | 本処理では Bento4 を使用する |
| `"mp4box"` | 本処理では `MP4Box` コマンドを使用する |
| `"gpac"` | 本処理では `gpac` コマンドを使用する |
| `"shaka"` | 本処理では Shaka Packager を使用する |

以降のオプションは `tool` の値によって設定可能な値が制限されている場合があります。これはそのツールに対応していない機能を利用することを指定できないようにするためです。  
`convertDescription` オブジェクトを規定する型 `ConvertDescription` はかなり厳格に規定されており、非対応の値が指定されていると型がエラーになるように作られています。

##### `runMode`

変換処理のモードを指定します。
以下の値から指定できます。

| 指定値 | 説明 |
|:--:|:--|
| `"mse"` | MSE API のみを使用するように、セグメント分割だけを実行します。 |
| `"mse+eme"` | MSE API + EME API を使用するように、セグメント分割と暗号化を実行します。 |
| `"eme"` | EME API のみを使用するように、暗号化を実行します。 |

※ `"eme"` を指定すると暗号化された単一のメディアファイルが生成されます。しかし、ほとんどのブラウザでは MSE を使用せずに EME を使用することはできないので、実際にはほとんどの環境で再生できないデータが出力されることになります。

##### `skipPreprocess`

事前処理をスキップするかどうか決めるブール値です。  
既に事前処理を実行したことがあり、事前処理時点までは全く同じ構成で、別の処理モードや別のツールを使う場合には改めて事前処理を行わないようにすることで時間短縮することができます。

##### `container`

変換後の出力メディアのコンテナ形式を指定します。  
なおここで指定した値により、この後の `videoCodec` や `audioCodec` で指定できる値が制限されることがあります。これはコンテナの対応しているコーデック形式が限られるためです。対応しているコンテナについては [Shaka Packager のドキュメント](https://github.com/shaka-project/shaka-packager/blob/main/README.md#:~:text=Media%20Containers%20and,BMFF%20is%20experimental.) に書かれた情報に準拠しています。

* `"mp4"`
	MP4 形式を選択します。  
	単一のファイルで出力する場合には `.mp4` 拡張子が選択されます。  
	セグメント分割を行う場合、初期セグメントは `.mp4` 拡張子、メディアセグメントは `.m4s` 拡張子が使用されます。
* `"webm"`  
	WebM 形式を選択します。  
	単一ファイルの場合も、セグメント分割後の初期セグメント、メディアセグメントも `.webm` 拡張子が使用されます。

##### `videoCodec`, `audioCodec`

事前処理 (プリプロセス) 以降のデータの映像コーデックや音声コーデックの種類を指定します。

`videoCodec` に指定できる値

| 指定値 | コーデック | 使用するエンコーダ |
|:--:|:--:|:--:|
| `"h264"` | H.264 (AVC) | `libx264` |
| `"h265"` | H.265 (HEVC) | `libx265` |
| `"vp9"` | VP9 | `libvpx-vp9` |
| `"vp8"` | VP8 | `libvpx` |
| `"av1"` | AV1 | `libsvtav1` |

`audioCodec` に指定できる値

| 指定値 | コーデック | 使用するエンコーダ |
|:--:|:--:|:--:|
| `"aac"` | AAC | `"aac"` |
| `"ac3"` | AC-3 | `"ac3"` |
| `"eac3"` | E-AC-3 | `"eac3"` |
| `"dts"` | DTS (DCA) | `"dca"` |
| `"opus"` | Opus | `"opus"` |
| `"vorbis"` | Vorbis | `"vorbis"` |

##### `pssh`

MP4 コンテナで暗号化する場合に PSSH 形式にするかどうかを指定します。  
PSSH 形式ではない場合基本的にはブラウザでは再生できません。  
一部の変換処理ツールではこの設定は指定できません。

##### `piff`

PlayReady で使われる PIFF 形式にするかどうか指定します。  
一部の変換処理ツールではこの設定は指定できません。

##### `direct`

遠回りせずに「一発で」変換処理を行うかどうか指定します。  
変換ツールの中にはセグメント分割や暗号化などの1つ1つの処理を分割して、何回か対応するコマンドを呼び出すことにより変換処理を実行するものもあります。また、映像と音声、映像も解像度ごと並行に別に取り扱っていたりします。
ここで `direct: true` を指定すると一部のツールでは変換方法が切り替わります。
例えば Bento4 で使用した場合にはフラグメント化、セグメント分割と別のステップ扱いになっていますが、 `direct: true` により映像と音声のそれぞれでセグメント化を簡単に実行するようになります。
一方で、 Shaka Packager では最初から1つのコマンドで複数入力、複数出力ができるようになっているので、 `direct` オプションは機能しません。

##### `emitMpd`

DASH の MPD ファイルを生成するかどうか指定します。  
一部のツールではこの値に依らず MPD ファイルが生成されます。

#### 出力先ディレクトリの指定

上記で示したように、生成したデータは通常 `media/segments`, `media/segments_encrypted`, `media/encrypted.mp4` に保存されます。  
しかし、 `convertDescription` の値を変えて別の出力をしたいこともあるはずです。  
用意された変数 `useOutDirectories` を `true` に指定すると、 `media` 直下に配置するのではなく、 `media` 以下に `convertDescription` の指定に合わせた別の名前のディレクトリを用意して、そちらに出力するようにします。

```typescript
export useOutDirectories: boolean = true;
```

例えば出力ツールを Shaka Packager 、コーデックを H.264 + AAC に指定した場合には、以下のように切り替わります。

| `useOutDirectories = false` の場合 | | `useOutDirectories = true` の場合 |
|:--|:--:|:--|
| `media/segments` | → | `media/output_shaka_h264_aac/segments` |
| `media/segments_encrypted` | → | `media/output_shaka_h264_aac/segments_encrypted` |
| `media/encrypted` | → | `media/output_shaka_h264_aac/encrypted.mp4` |
| `media/intermediates` | → | `media/intermediates` (変化なし) |

この通り、構成により `out_shaka_h264_aac` という名称に決められましたが、カスタムな値に設定することもできます。  
`useOutDirectories` の直後に用意されている `useCustomOutDirName` に文字列を指定すると、その通りのディレクトリ名に切り替わります。

```typescript
// この状態だと `out_shaka_h264_aac` のような構成により決まる名称となる
export const useCustomOutDirName: string | null = null;

// この状態だと `my_config` という名称が使用されるようになる
export const useCustomOutDirName: string | null = "my_config";
```

#### 解像度の定義

映像ファイルは複数の解像度に対して生成されます。生成する解像度を表す文字列を配列にして指定します。 `WxH` (真ん中はエックス) の形式で表します。

```typescript
export const resolutions = [
	"426x276", "640x416", "854x556", "1280x832", "1920x1248"
] as const;
```

#### 暗号化の設定

暗号化する時に使用する鍵を映像と音声のそれぞれで指定します。

```typescript
export const encryptionKeys: EncryptionKeys = {
	video: {
		keyId: "",
		key: ""
	},
	audio: {
		keyId: "",
		key: ""
	}
};
```

#### ストリーミング固有の設定

以下はストリーミング用のコンテンツを生成するにあたって使用するパラメータになります。

* `segmentDuration` (`float`)  
	1つのセグメントあたりの再生秒数を指定します。つまりセグメント分割の処理によりこの秒数ごとに区切ったセグメントが生成されます。
* `segmentCount` (`uint`)  
	ストリームあたり (1解像度の映像あるいは音声あたり) の全セグメントの個数を指定します。  
	全再生時間を `segmentDuration` で割った値を切り上げて整数にした値を設定してください。
* `videoFramerate` (`uint`)  
	映像のフレームレートを指定します。使用する動画ファイルのフレームレートは `ffprobe` などで確認することができます。

#### 動画ファイルのパスに関する設定

動画ファイルのパスを指定する設定項目があります。  
`originalPath` 以外は上記の `useOutDirectories` や `useCustomOutDirName` で制御されているので、基本的には書き換える必要はありません。

* `originalPath`  
	変換元となる動画ファイルのパスを指定します。
* `intermediateDirPath`  
	処理の中間生成物が格納されるディレクトリのパスを指定します。
* `segmentsDirPath`  
	MSE 向けにセグメント分割した動画ファイルが格納されるディレクトリのパスを指定します。  
	`convertDescription.runMode = "mse"` で処理を行った場合の保存先です。  
* `encryptedSegmentsDirPath`  
	MSE+EME 向けに暗号化しセグメント分割した動画ファイルが格納されるディレクトリのパスを指定します。  
	`convertDescription.runMode = "mse+eme"` で処理を行った場合の保存先です。
* `encryptedMediaPath`  
	EME 向けに暗号化した動画ファイルが保存されるパスを指定します。  
	`convertDescription.runMode = "eme"` で処理を行った場合の保存先です。  
	拡張子は省略します。

注意: 上記のパスの設定を変えると、フロントエンド側で指定されるパスだけでなく、サーバ側スクリプトのフィルタリング設定も変える必要があります。

#### シェルコマンドの実行に関する設定

コマンドの実行に関して幾つかブール値による設定項目があります。

* `dryRun`  
	実際に処理内容を実行する代わりに、処理内容の表示だけを行うモードを有効にします。
* `disableParallel`  
	並列な処理の実行をブロックする機能を有効化します。  
	通常は互いに影響のない処理があれば並列に実行するように作られています。  
	しかしデバッグが必要な場合など、並列に実行しないようにしたい場合にはこの変数を `true` に設定します。
* `showCommands`  
	`dryRun` とは違って実際に実行されます。その上で処理内容の表示も行うモードを有効にします。

### フロントエンド実装の設定 (`ts_src/consts.ts`)

#### 機能の有効化/無効化

各種機能を有効/無効にするフラグ変数 (`boolean`) が用意されています。デフォルトでは `false` に設定されており使用できませんが、 `true` に設定すると有効化されます。

| 変数 | 説明 |
|:--|:--|
| `enableMSE` | MSE API を使った機能の有効/無効を切り替える |
| `enableEME` | EME API を使った機能の有効/無効を切り替える |
| `enableAutoResolution` | `enableMSE` が `true` の時に、解像度選択の自動設定の有効/無効を切り替える |

但しそれぞれの変数は、以下の設定項目を書き換えないと有効化しても正常に作動しないようになっています。忘れずに設定してください。

#### パラメータを設定する関数

##### `getVideoSegmentUrl`, `getAudioSegmentUrl`

MSE API を使った再生において、映像と音声のそれぞれについてセグメントのパスを返す関数を用意します。 `enableMSE` を `true` に設定する時には必ずこちらを適切に設定してください。

必要としている解像度 (映像のみ) とセグメント番号の値から、対応するパスを指定するようにします。

解像度は後述のインデクス番号の整数により与えられます。

セグメント番号は、 `-1` であれば初期セグメント (`init.mp4`) 、 0 以上の値であれば通常のセグメントを返すようにします。

```typescript
// 映像のセグメントパス
export const getVideoSegmentUrl = (
	resIndex: ResIndex,  // 解像度番号
	segmentIndex: number // セグメント番号
): string => {
	// TODO: 適切なパスを返す
	return "";
};

// 音声のセグメントパス
export const getAudioSegmentUrl = (
	segmentIndex: number // セグメント番号
): string => {
	// TODO: 適切なパスを返す
	return "";
};
```

##### `getOptimalResolution`

解像度として「自動」が選択された時に、現在の再生状況に応じて適切な解像度を返す関数を用意します。 `enableAutoResolution` を `true` に設定する時は必ずこちらを適切に設定してください。

引数として現在の再生状況を表すオブジェクト `playerState` を受け取り、その値に応じて最適な解像度を選択し、その番号を返すようにします。

`playerState` は以下のプロパティを持ちます。


| プロパティ | 説明 |
|:--|:--|
| `currentTime` | 現在の再生位置 (先頭からの秒数) |
| `lastLoadedSegmentIndex` | 最後に読み込みが完了したセグメントの番号 (0,1,2,...) |
| `nextLoadingSegmentIndex` | 次に読み込む予定のセグメントの番号 (0,1,2,...) |
| `isOffline` | オフラインと判定されているか否か (`true` / `false`) |

```typescript
export const getOptimalResolution = (
	playerState: PlayerState
): ResIndex => {
	return 1;
};
```

##### `encryptionKeys`

暗号化に使用された鍵を設定します。 `enableEME` を `true` に設定する時は必ずこちらを適切に設定してください。

映像と音声に分けて指定することが可能になっていますが、特に違いはありませんし、逆に設定しても正常に機能します。 Key ID に対応する適切な Key を設定しないと復号ができず、再生できません。

```typescript
export const encryptionKeys: EncryptionKeys = {
	video: {
		keyId: "",
		key: ""
	},
	audio: {
		keyId: "",
		key: ""
	}
};
```

ここで `keyId` や `key` として設定可能な値は32桁の16進数です。これは以下のコマンドにより簡単に生成することができます。

```shell
openssl rand -hex 16
```

#### 解像度の定義

動画コンバーターで作成する時に設定した動画の解像度をここでも設定することで、作成した解像度の動画が再生できるようになります。

`resolution` 変数においては、解像度選択メニューで表示する形式で解像度を表す文字列をリスト形式で指定します。値に重複があってはなりません。

```typescript
export const resolutions = [
	"426x276", "640x416", "854x556", "1280x832", "1920x1248"
] as const;
```

`resolutionIndexes` においては、 `resolution` で用意したそれぞれの解像度に対してインデクス番号を割り振ります。他の関数ではこの番号を使って解像度を指定することになります。

```typescript
export const resolutionIndexes = {
	"426x276":   1,
	"640x416":   2,
	"854x556":   3,
	"1280x832":  4,
	"1920x1248": 5,
} as const;
```

#### ストリーミング固有の設定

以下はストリーミングにあたって使用するパラメータになります。適切な値を設定しないとプレーヤーが正しく機能しなくなります。

* `segmentDuration` (`float`)  
	1つのセグメントあたりの再生秒数を指定します。  
	コンバート時に設定した値を使用してください。
* `segmentCount` (`uint`)  
	ストリームあたり (1解像度の映像あるいは音声あたり) の全セグメントの個数を指定します。  
	全再生時間を `segmentDuration` で割った値を切り上げて整数にした値を設定してください。
* `maxBufferDuration` (`float`)  
	バッファをとる最大秒数を指定します。ネットワーク環境が良好であってもこれより長い秒数でバッファを用意することはありません。
* `advanceSegmentsAfterSeekEnd` (`uint`)  
	シーク後のセグメント読み込みで予め読み込んでおくセグメントの数を指定します。  
	少なすぎると再生してもすぐバッファ不足になり再生が止まってしまいます。
* `advanceSegmentsAfterWaiting` (`uint`)  
	バッファ不足で再生が止まるとバッファ取得を試みますが、そのバッファ取得に成功した後に予め読み込んでおくセグメントの数を指定します。  
	少なすぎるとまたすぐにバッファ不足になり再生が止まってしまいます。

## ソースファイルの構成

### フロントエンド JavaScript コード (`ts_src`)

| ファイル | 説明 |
|:--|:--|
| `consts.ts` | 定数値の宣言と、条件に応じて値を返すだけの関数の実装 |
| `core.ts` | JavaScript による処理のエントリポイント |
| `mse.ts` | MSE API を使った処理が用意されている |
| `mse_utils.ts` | `mse.ts` で使用するユーティリティ関数や型を用意する |
| `eme.ts` | EME API を使った処理が用意されている |
| `eme_utils.ts` | `eme.ts` で使用するユーティリティ関数や型を用意する |
| `interface.ts` | 表示する UI 機能を実装する |
| `interface_utils.ts` | `interface.ts` で使用するユーティリティ関数を用意する |
| `log.ts` | カスタマイズしたログ出力を行う関数を用意する |
| `utils.ts` | 全体で共通して利用するユーティリティを用意する |
| `misc.ts` | その他分類しづらい細々とした処理を用意する |

### フロントエンドリソース (`resources`)

| ファイル | 説明 |
|:--|:--|
| `style.css` | スタイルシートのエントリポイント (他の `css` ファイルを読み込む専用) |
| `base-layout.css` | 基本となるレイアウトを構成する |
| `conditional-layout.css` | 設定に応じて変化するレイアウトを用意する |
| `colors.css` | 色指定を行う |
| `icon.png` | ファビコン画像 |

### 動画変換ツール (`scripts/converter`)

| ファイル | 説明 |
|:--|:--|
| `consts.ts` | 設定値を含む定数値の宣言を行う |
| `main.ts` | 処理のエントリポイントとして `main` 関数を用意して、実行している |
| `ffmpeg/template.ts` | 完全に FFmpeg を使って処理を行う場合の処理内容のテンプレートを実装する |
| `ffmpeg/preprocess.ts` | その後に使用するツールに依らない FFmpeg を使ったプリプロセス処理を実装する |
| `ffmpeg/command.ts` | `ffmpeg` コマンドのラッパー関数 `ffmpeg` を実装して、コマンドへ橋渡しする |
| `bento4/template.ts` | Bento4 を使って処理を行う場合の処理内容のテンプレートを実装する |
| `bento4/command.ts` | 各種 Bento4 のコマンドのラッパー関数を実装して、コマンドへ橋渡しする |
| `gpac/template-mp4box.ts` | `MP4Box` を使って処理を行う場合の処理内容のテンプレートを実装する |
| `gpac/command-mp4box.ts` | `MP4Box` コマンドのラッパー関数 `mp4box` を実装して、コマンドへ橋渡しする |
| `gpac/template-gpac.ts` | `gpac` を使って処理を行う場合の処理内容のテンプレートを実装する |
| `gpac/command-gpac.ts` | `gpac` コマンドのラッパー関数 `gpac` を実装して、コマンドへ橋渡しする |
| `gpac/create-crypt-file.ts` | `gpac` や `MP4Box` の処理で利用する、暗号化構成が書かれた XML ファイルを生成する |
| `shaka/template.ts` | Shaka Packager を使って処理を行う場合の処理内容のテンプレートを実装する |
| `shaka/command.ts` | `packager` コマンドのラッパー関数 `packager` を実装して、コマンドへ橋渡しする |
| `utils/file-handle.ts` | ファイル操作関連の関数を実装している |
| `utils/exec.ts` | シェルコマンドを実行する関数 `exec`, `execSimple` を実装している |
| `utils/config.ts` | 構成に基づく各種データを用意している |
| `utils/misc.ts` | その他諸々のユーティリティ関数を用意する |
| `types/convert-description.ts` | `convertDescription` 向けの型を定義している |
| `types/crypt.ts` | 暗号化関連の型を定義している |

## メモ

* MSE API を利用せず EME API のみを利用するケースは正しく動作しないはず。
	* 少なくとも Firefox ではコンソール中に MSE API を使わないで EME API を使用することはできない、と表示されるので全く使えない
* ~Visual Studio Code で作業する場合、 `scripts` ディレクトリ内の TypeScript ファイルの一部において、 Node.js 標準モジュールの `import` 文にエラーが表示されることがあります。解決策が判明しておらず、解決できていない。このエラーが発生している場合は、 `scripts` 内にある他のツールを構成する TypeScript ファイルを開くことで解決する場合がある。~
	* かつてはこの問題が発生していたが、最近は解決した模様

## 参考にした実装

ここに用意しているコードは主に以下のリポジトリを参考に作られました。

* `media-player-demo-2024`  
	URL: https://github.com/access-company/media-player-demo-2024

* `mse-eme`  
	URL: https://github.com/cpearce/mse-eme
