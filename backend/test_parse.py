import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agents.intent_agent import classify_and_link
res = classify_and_link("What is the publish rate?")
print("Result:", res)
