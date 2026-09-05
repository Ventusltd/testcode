"""Prepare one measured homepage restore point and append the new Test Code link."""
import pathlib, subprocess, hashlib, json, re, datetime, sys
root=pathlib.Path(sys.argv[1]).resolve()
generation=sys.argv[2]
assert re.fullmatch(r'\d{12}',generation)
index=root/'index.html'
data=index.read_bytes()
text=data.decode('utf8')
folder=root/'homepage_versions'
versions=list(folder.glob('homepage_v*.html'))
number=max(int(re.search(r'v(\d+)',p.name).group(1)) for p in versions)+1
snapshot=folder/f'homepage_v{number:03}.html'
assert not snapshot.exists()
source=subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD'],text=True).strip()
measurement={'created_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'folder_file_count_before':sum(p.is_file() for p in folder.iterdir()),'html_version':snapshot.name,'line_count':len(text.splitlines()),'word_count':len(text.split()),'character_count':len(text),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'source_commit':source,'intention':f'Add Test Code {generation} with Print and Print source code. Retain prior Test Code as an older comparison link.'}
snapshot.write_bytes(data)
(folder/f'homepage_v{number:03}-measurement.json').write_text(json.dumps(measurement,indent=2)+'\n',encoding='utf8')
assert f'./testcode/{generation}/' not in text, 'generation already linked'
anchor=re.search(r'<p><a href="\./testcode/\d{12}/">',text).group(0)
assert text.count(anchor)==1,'expected previous Test Code row'
new=f'<p><a href="./testcode/{generation}/">Print test candidate — {generation} UTC</a>: <strong>File → Print</strong> keeps the full screen and its layers, with a header and footer. <strong>Print source code</strong> includes the current view and fetched dependencies for attaching in AI chat. Testing is in progress; this is not a Design Freeze.</p>\n'
text=text.replace(anchor,new+anchor,1)
text=text.replace('>Grid compute detector — 202609051344 UTC</a>', '>Previous Test Code — 202609051344 UTC</a>',1)
index.write_text(text,encoding='utf8',newline='\n')
print(json.dumps(measurement,indent=2))
