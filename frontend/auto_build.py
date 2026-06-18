import wexpect
import sys
import os
import time

# os.environ['EXPO_TOKEN'] removed to use global eas credentials

print("Spawning EAS CLI with wexpect...", flush=True)
child = wexpect.spawn('eas build -p android --profile preview')

print("Waiting for Keystore prompt...", flush=True)
try:
    # Wait up to 3 minutes for the keystore prompt
    index = child.expect(['Generate a new Android Keystore', wexpect.EOF], timeout=180)
    
    if index == 0:
        print("Found Keystore prompt! Sending 'Y'...", flush=True)
        child.sendline('Y')
        print("Sent Y. Now waiting for build upload to finish (up to 10 mins)...", flush=True)
        child.expect(wexpect.EOF, timeout=600)
        if hasattr(child, 'before'):
            print(child.before.encode('utf-8', 'ignore').decode('utf-8'), flush=True)
        
    elif index == 1:
        print("Finished without prompt.", flush=True)
        if hasattr(child, 'before'):
            print(child.before.encode('utf-8', 'ignore').decode('utf-8'), flush=True)
except Exception as e:
    print(f"Exception: {e}", flush=True)
    if hasattr(child, 'before'):
        print(child.before.encode('utf-8', 'ignore').decode('utf-8'), flush=True)

print("Script Complete.", flush=True)
