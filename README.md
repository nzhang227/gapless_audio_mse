# Gapless Audio MSE
Gapless Audio MSE uses MSE to concatenate two encoded fragmented MP4 (AAC) files 
into a gapless audio stream. If player and MSE work correctly, the transition in
the middle of the timeline should be seamless and users shouldn't hear a pop.

To try it out, please visit [Gapless Audio MSE Demo](https://nzhang227.github.io/gapless_audio_mse/demo.html).

# Background
For [Gapless Playback](https://en.wikipedia.org/wiki/Gapless_playback), there are a variety of ways to create gapless content. For this demo, the gapless metadata is encoded in the MP4 file according to the MPEG Edit List standard (defined in ISO 14496-12 subsection 8.6.5).

# Solution
Referenced from [ISO-Init-Segments](https://www.w3.org/TR/mse-byte-stream-format-isobmff/#iso-init-segments):
> The user agent must support setting the offset from media composition time to movie presentation time by handling an Edit Box (edts) containing a single Edit List Box (elst) that contains a single edit with media rate one. This edit may have a duration of 0 (indicating that it spans all subsequent media) or may have a non-zero duration (indicating the total duration of the movie including fragments).

As a result, it's MSE's obligation to
* Parse ELST and get some gapless metadata like media_time, segment_duration and so on
* Shift timestamp according to media_time
* Trim extra leading/trailing samples as ELST suggests? The document is quite vague about it. But Chrome confirmed that currently Chrome MSE trims exactly leading samples as media_time suggests. So Let's assume other MSE implementations align with it

So it seems like for Gapless Playback, player should
* Trim extra trailing samples. The number can be got from the final packet duration in TRUN

Based on these assumptions, I've got GaplessAudioPlayer at [Gapless Audio MSE Demo](https://nzhang227.github.io/gapless_audio_mse/demo.html). 

## Test Results
Unforturnately, the demo doesn't work out as expected. Seems like most media stacks don't handle ELST correctly.

| Browser | Version                                 | OS                                           | Demo Works |
|:--------|:----------------------------------------|:---------------------------------------------|:-----------|
| Chrome  | 69.0.3497.100 (Official Build) (64-bit) | Debian GNU/Linux 4.17.0-3rodete2-amd64       | NO         |
| Firefox | 60.2.0esr (64-bit)                      | Debian GNU/Linux 4.17.0-3rodete2-amd64       | NO         |
| IE11    | 11.726.16299.0                          | Windows 10 Version 1709 (OS Build 16299.726) | NO         |
| Edge    | 41.16299.726.0                          | Windows 10 Version 1709 (OS Build 16299.726) | NO         |

# Workaround
Since currently most MSE implementations don't handle ELST correctly, and the behavior is quite unpredictable, to workaround those issues, player needs to remove all the special features that MSE implementations can mess up on when trimming. A reasonable workaround can be:
* Player parses ELST and get gapless metadata
* Player modifies the moov and moof to remove ELST and reset final packet duration, before pushing moov and moof into MSE
* According to gapless metadata, Player sets appendWindowStart/appendWindowEnd/timestampOffset in order to do timestamp shifting, front-trimming and end-trimming

Based on the workaround, I've got GaplessAudioPlayerWorkaround at [Gapless Audio MSE Demo](https://nzhang227.github.io/gapless_audio_mse/demo.html).

## Test Results
This workaround works perfectly gapless on Chrome, but not on other browsers. 

| Browser | Version                                 | OS                                           | Demo Works |
|:--------|:----------------------------------------|:---------------------------------------------|:-----------|
| Chrome  | 69.0.3497.100 (Official Build) (64-bit) | Debian GNU/Linux 4.17.0-3rodete2-amd64       | YES        |
| Firefox | 60.2.0esr (64-bit)                      | Debian GNU/Linux 4.17.0-3rodete2-amd64       | NO         |
| IE11    | 11.726.16299.0                          | Windows 10 Version 1709 (OS Build 16299.726) | NO         |
| Edge    | 41.16299.726.0                          | Windows 10 Version 1709 (OS Build 16299.726) | NO         |

## Root Cause
Seems like other browsers got different issues from Chrome. I believe the major reason is that they don't support sample-accurate-audio-splicing.

Refrenced from [Coded Frame Processing](https://www.w3.org/TR/media-source/#sourcebuffer-coded-frame-processing):
> 8. If presentation timestamp is less than appendWindowStart, then set the need random access point flag to true, drop the coded frame, and jump to the top of the loop to start processing the next coded frame.
> NOTE
> Some implementations may choose to collect some of these coded frames with presentation timestamp less than appendWindowStart and use them to generate a splice at the first coded frame that has a presentation timestamp greater than or equal to appendWindowStart even if that frame is not a random access point. Supporting this requires multiple decoders or faster than real-time decoding so for now this behavior will not be a normative requirement.
>
> 9. If frame end timestamp is greater than appendWindowEnd, then set the need random access point flag to true, drop the coded frame, and jump to the top of the loop to start processing the next coded frame.
> NOTE
> Some implementations may choose to collect coded frames with presentation timestamp less than appendWindowEnd and frame end timestamp greater than appendWindowEnd and use them to generate a splice across the portion of the collected coded frames within the append window at time of collection, and the beginning portion of later processed frames which only partially overlap the end of the collected coded frames. Supporting this requires multiple decoders or faster than real-time decoding so for now this behavior will not be a normative requirement. In conjunction with collecting coded frames that span appendWindowStart, implementations may thus support gapless audio splicing.

Without sample-accurate-audio-splicing, Gapless Audio Playback on HTML5 seems like a mission impossible. I sincerely hope that MSE implementations like Firefox and Edge could resolve the problem.

# Details about the test files
The gapless test files are under resources folder.

## About tone_(1|2).mp4
The flac files were generated by splitting a single file into 2 flacs.
Each flac is 110250 samples.

The flac files were re-encoded to AAC with an encoder which has an encoder delay
of 1600 samples, and muxed into fragmented mp4 files.
(These examples have single fragment, but others will not).

The FMP4 files were produced by
 * Setting mvhd.timescale and mdhd.timescale to the sample rate.
 * Adding single edit to edit list
 * Setting edit media time to 1600, to account for encoder delay.
 * Setting edit segment duration to 110250, to account for trailing samples due 
 to AAC packet sample count.
 * All presentation durations are also 110250, as they should be.
   (sidx durations, mvhd.duration, tkhd.duration, mdhd.duration)

The encoded AAC fragmented MP4 files have the following properties:
 * Encoder delay of 1600 samples.
 * Edit list with media time of 1600 and segment duration of 110250
 * In order to get gapless playback, 1600 leading samples and 790 trailing 
 samples should be trimmed
 * After trimming leading and trailing samples (due to edit list), there should 
 be 110250 samples.

Let's do some math:
* segment_duration = 110250 (2.5s)
* media_time =  1600
* total_frames = 110
* samples_per_frame = 1024
* total_samples_before_trim = total_frames * samples_per_frame = 112640
* total_samples_after_trim = segment_duration = 110250
* leading_samples_to_trim = 1600
* trailing_samples_to_trim = total_samples_before_trim - total_samples_after_trim - leading_samples_to_trim = 790

## About tone_(1|2)_no_elst.mp4
It seems like most media stacks don't handle ELST correctly. In order to workaround this, we have another test case to remove all the special features that browser can mess up on trimming. 

In order to do that, I manually changed the test files using a hex editor:
* Mark EDTS as SKIP box. Simply search in the binary for EDTS and change it to SKIP
* Set last packet duraion in TRUN back to 1024

# References
* [Media Source Extensions for Audio](https://developers.google.com/web/updates/2015/06/Media-Source-Extensions-for-Audio)