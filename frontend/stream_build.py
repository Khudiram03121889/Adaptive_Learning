import wexpect
import sys
import os

os.environ['EXPO_TOKEN'] = "2Spjt42C94umtBCEDy0Bg69P1N3cinqnxXr0lKpK"

child = wexpect.spawn('eas build -p android --profile preview')

buffer = ""
while True:
    try:
        c = child.read_nonblocking(size=1)
        sys.stdout.write(c.encode('utf-8', 'ignore').decode('utf-8'))
        sys.stdout.flush()
        buffer += c
        
        if "Generate a new Android Keystore" in buffer:
            sys.stdout.write("\n[PYTHON] Found Keystore prompt! Sending Y\n")
            sys.stdout.flush()
            child.sendline('Y')
            buffer = ""
            
    except wexpect.EOF:
        break
    except Exception as e:
        pass
