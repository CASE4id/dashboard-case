import subprocess,re,sys
pdf=sys.argv[1]
n=int(re.search(r"Pages:\s+(\d+)",subprocess.run(["pdfinfo",pdf],capture_output=True,text=True).stdout).group(1))
want={"1","2","8","16","19","21","23","28","29","30"}
empty=0
for p in range(1,n+1):
    t=subprocess.run(["pdftotext","-layout","-f",str(p),"-l",str(p),pdf,"-"],capture_output=True,text=True).stdout
    if not t.strip(): empty+=1; continue
    if "Aceh" not in t: continue
    m=re.search(r"Tabel(?:/Table)?\s*(\d+)\s*:?\s*(.{0,60})",t)
    print(p, (m.group(1)+" "+m.group(2).strip()) if m else "(continuation)")
print("pages",n,"empty",empty)
