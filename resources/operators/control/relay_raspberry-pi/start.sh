#!/bin/bash
cd $1
nohup python3 relay_raspberry-pi.py $2 > start.log &