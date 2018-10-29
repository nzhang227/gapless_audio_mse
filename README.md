# Gapless Audio MSE
[Gapless Audio MSE Demo](https://nzhang227.github.io/gapless_audio_mse/demo.html)

# About the test files
The flac files were generated by splitting a single file into 2 flacs.
Each flac is 110250 samples.

The flac files were reencoded to AAC with an encoder which has an encoder delay
of 1600 samples, and muxed into fragmented mp4 files.
(These examples have single fragment, but others will not).

The FMP4 files were produced by
 * Setting mvhd.timescale and mdhd.timescale to the sample rate.
 * Adding single edit to edit list
 * Setting edit media time to 1600, to account for encoder delay.
 * Setting edit segment duration to 110250, to account for trailing samples due to AAC packet sample count.
 * All presentation durations are also 110250, as they should be.
   (sidx durations, mvhd.duration, tkhd.duration, mdhd.duration)

The encoded AAC fragmented MP4 files have the following properties:
 * Encoder delay of 1600 samples.
 * Edit list with media time of 1600 and segment duration of 110250
 * In order to get gapless playback, 1600 leading samples and 790 trailing samples should be trimmed
 * After trimming leading and trailing samples (due to edit list), there should be
110250 samples.

segment_duration = 110250 (2.5s)
media_time =  1600
frames = 110
total_samples_before_trim = 110 * 1024 = 112640

leading_samples = 1600
trailing_samples = 112640 - 110250 - 1600 = 790

## tone_1_no_elst.mp4
Use a hex editor called bless to modify the file.
- Mark EDTS as SKIP box
	- Search for "edts" and override the corresponding binary from "65 64 74 73" to "73 6b 69 70"
- Last frame duration in TRUN box
	- override "00 EA" to "04 00"