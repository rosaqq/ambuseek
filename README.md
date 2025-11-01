# AmbuSeek™ playground
(™ is a joke)

Live at https://rosaqq.github.io/ambuseek/  
(100% local - you need to get the datasets so you can load them from your machine)  

This is a second take at the 2025 SciTech Hackathon challenge!  
Got the motivation after playing with [this code by @CokieMiner](https://github.com/CokieMiner/SciTech/) and reading a bit about the [A* algorithm](https://en.wikipedia.org/wiki/A*_search_algorithm)  

- Weighted graph of Hospitals and Patients.
- Each patient had a score and an immediate care time.
- An ambulance must go pick them up, provide immediate care, and bring them to a hospital.
- Goal was to maximize total score of treated patients for a given input "run time".

And extra points for UI/UX with a visualizer for our ambulance.  

Note that current code is a patchwork of heavy ChatGPT snippets and has a lot of dumb in it.  
But the general idea is there :)

# Nerd notes
1. At the moment no heuristic is implemented so A* is effectively behaving like Dijkstra
2. I still haven't studied enought about the heuristics part to get there, explanations/suggestions welcome
3. Let's ignore how the marginal improvement from heuristics is obliterated by basic code optimization fails at the moment
