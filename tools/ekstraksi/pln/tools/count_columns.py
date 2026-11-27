import subprocess,re,sys
sys.argv=[sys.argv[0]]+sys.argv[1:]
pdf=sys.argv[1]; pages=[int(x) for x in sys.argv[2].split(",")]
for p in pages:
    t=subprocess.run(["pdftotext","-layout","-f",str(p),"-l",str(p),pdf,"-"],capture_output=True,text=True).stdout
    lines=[l for l in t.splitlines() if l.strip()]
    def cnt(l):
        toks=l.split(); n=0
        while toks and re.match(r"^\(?-?[\d.,]+\)?(\*+\))?$|^-$",toks[-1]): toks.pop(); n+=1
        return " ".join(toks)[:28], n
    out=[]
    for l in lines:
        nm,n=cnt(l)
        if re.match(r"^(UID Aceh|Uid Aceh|Indonesia|In d o|Luar Jawa|Jawa|Outside Java|Java)",nm) or (not nm and n>3 and len(out)<1):
            out.append(f"{nm or '(nums)'}={n}")
    print(p, out[:5])
