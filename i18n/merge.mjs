import { readFile, writeFile } from 'node:fs/promises'
// Lets keep this in case we add languages
async function main() {
	const [src, ar] = (await Promise.all([
		await readFile('dictionary.db.org', 'utf16le'),
		await readFile('dictionary.db.ar', 'utf16le')
	])).map(s=>s.split('\n'))
	const out = src.slice(0,3);
	let srcCpt=3, arCpt=3
	while(srcCpt<src.length || arCpt<ar.length) {
		if (src[srcCpt] !== ar[arCpt]){
			console.error(`key error: ${src[srcCpt]} vs ${ar[arCpt]}`);
			return
		}
		console.log(src[srcCpt])
		out.push(ar[arCpt])
		srcCpt++;
		arCpt++;
		while(srcCpt<src.length && src[srcCpt][0] === '\t') {
			out.push(src[srcCpt++])
		}
		while(arCpt<ar.length && ar[arCpt][0] === '\t') {
			if(!ar[arCpt].startsWith('\ten:'))
				out.push(ar[arCpt])
			arCpt++;
		}
	}

	await writeFile('dictionary.db', out.join('\n'), 'utf16le')
}
main()