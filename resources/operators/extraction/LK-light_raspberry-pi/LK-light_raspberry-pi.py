#!/usr/bin/env python
# -*- coding: utf-8 -*-
import sys, getopt
import paho.mqtt.client as mqtt
from datetime import datetime
import time
import json
import os, fnmatch
from os.path import expanduser

# hardware imports
import RPi.GPIO as GPIO
import spidev

# global hardware config
GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)

# - sensor channel
adc_channel = int(2)

############################
# MQTT Client
############################
class mqttClient(object):
   hostname = 'localhost'
   port = 1883
   clientid = ''

   def __init__(self, hostname, port, clientid):
      self.hostname = hostname
      self.port = port
      self.clientid = clientid

      # create MQTT client and set user name and password 
      self.client = mqtt.Client(client_id=self.clientid, clean_session=True, userdata=None, protocol=mqtt.MQTTv31)
      #client.username_pw_set(username="use-token-auth", password=mq_authtoken)

      # set mqtt client callbacks
      self.client.on_connect = self.on_connect

   # The callback for when the client receives a CONNACK response from the server.
   def on_connect(self, client, userdata, flags, rc):
      print("[" + datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3] + "]: " + "ClientID: " + self.clientid + "; Connected with result code " + str(rc))

   # publishes message to MQTT broker
   def sendMessage(self, topic, msg):
      self.client.publish(topic=topic, payload=msg, qos=0, retain=False)
      print(msg)

   # connects to MQTT Broker
   def start(self):
      self.client.connect(self.hostname, self.port, 60)

      #runs a thread in the background to call loop() automatically.
      #This frees up the main thread for other work that may be blocking.
      #This call also handles reconnecting to the broker.
      #Call loop_stop() to stop the background thread.
      self.client.loop_start()

      
############################
# Analog in (on linker-base ADC)
############################
class analogInputReader(object):
   def __init__(self):
      self.spi = spidev.SpiDev()
      self.spi.open(0,0) # (bus, device)
 
   def readadc (self, adPin):
      # read SPI data from MCP3004 chip, 4 possible adc’s (0 thru 3)
      if ((adPin > 3) or (adPin < 0)):
         return -1
      r = self.spi.xfer2([1,8+adPin <<4,0])
      #print(r)
      adcout = ((r[1] &3) <<8)+r[2]
      return adcout
 
   def getLevel (self, adPin):
      value = self.readadc(adPin)
      volts = (value*3.3)/1024
      return (volts, value)
 
   def getTemperature (self, adPin):
      v0 = self.getLevel(adPin)
      temp = (((v0[0] * 1000) - 500)/10) # celsius
      return temp
   
   def getLight (self, adPin):
      # light dependt resistor (LDR): resistence of the light sensor decreases when light intensity increases
      v0 = self.getLevel(adPin)
      #print (v0[0])
      #print (v0[1])
      resistenceSensor = ((1023 - v0[1])*10)/v0[1]
      return resistenceSensor

############################
# MAIN
############################
def main(argv):
   #default interval for sending data
   measureInterval = 10
   
   configFileName = "connections.txt"
   topics = []
   brokerIps = []
   configExists = False

   hostname = 'localhost'
   topic_pub = 'test'
   
   configFile = os.path.join(os.getcwd(), configFileName)

   while (not configExists):
       configExists = os.path.exists(configFile)
       time.sleep(1)

   # BEGIN parsing file
   fileObject = open (configFile)
   fileLines = fileObject.readlines()
   fileObject.close()

   for line in fileLines:
       pars = line.split('=')
       topic = pars[0].strip('\n').strip()
       ip = pars[1].strip('\n').strip()
       topics.append(topic)
       brokerIps.append(ip)

   # END parsing file

   hostname = brokerIps [0]
   topic_pub = topics [0]
   topic_splitted = topic_pub.split('/')
   component = topic_splitted [0]
   component_id = topic_splitted [1]
   
   print("Connecting to: " + hostname + " pub on topic: " + topic_pub)
   
   # --- Begin start mqtt client
   id = "id_%s" % (datetime.utcnow().strftime('%H_%M_%S'))
   publisher = mqttClient(hostname, 1883, id)
   publisher.start()

   # Hardware - init analog input reader
   aiReader = analogInputReader()
   
   try:  
      while True:
         # messages in json format
         # send message
         t = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]

         # reading
         measured_value = aiReader.getLight(adc_channel)
         
         msg_pub = {"component": component.upper(), "id": component_id, "value": "%.3f" % (measured_value)}
         publisher.sendMessage (topic_pub, json.dumps(msg_pub))

         time.sleep(measureInterval)
   except:
      e = sys.exc_info()
      print ("end due to: ", str(e))

if __name__ == "__main__":
   main(sys.argv[1:])
