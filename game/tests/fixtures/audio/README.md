# Test audio only

`silence_80ms.ogg` contains 80 ms of mono digital silence at 22,050 Hz, encoded with FFmpeg's libvorbis encoder:

```sh
ffmpeg -f lavfi -i anullsrc=r=22050:cl=mono -t 0.08 -c:a libvorbis silence_80ms.ogg
```

It exercises actual OGG loading, looping and resource-copy behavior in the audio tests. It is not music, is not assigned to any game cue, and must not be promoted as the owner's main theme.
