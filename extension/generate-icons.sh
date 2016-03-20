#!/bin/bash

opts="-colorspace RGB +sigmoidal-contrast 11.6933 -define filter:filter=Sinc -define filter:window=Jinc -define filter:lobes=3 -sigmoidal-contrast 11.6933 -colorspace sRGB -background transparent -gravity center"
iconopts=""

lighthouse="app/lighthouse.png"
filename="lighthouse-crop.png"

reduced="app/lighthouse-reduced.png"

# crop to square
convert $lighthouse $opts -crop 648x648+0+0 $filename

# 128 lighthouse
convert $filename  $opts -resize 128x128 app/images/icon-128.png

# 48
convert $reduced $opts -resize 48x48 app/images/icon-48.png
# 38
convert $reduced $opts -resize 38x38 app/images/icon-38.png
# 19
convert $reduced $iconopts -resize 19x19 app/images/icon-19.png
# 16
convert $reduced $iconopts -resize 16x16 app/images/icon-16.png


rm $filename

