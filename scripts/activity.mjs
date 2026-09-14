import fs from 'node:fs/promises';
const owner='rudevv';
const now=new Date();
const end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1));
const start=new Date(end.getTime()-84*86400000);
const headers={'User-Agent':'rudevv-profile','Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
if(process.env.GH_TOKEN)headers.Authorization='Bearer '+process.env.GH_TOKEN;
async function get(route){const r=await fetch('https://api.github.com'+route,{headers});if(!r.ok)throw Error(`GitHub returned ${r.status} for ${route.split('?')[0]}`);return r.json();}
async function search(q){const results=[];let total=0;for(let page=1;page<=10;page++){const data=await get('/search/issues?q='+encodeURIComponent(q)+'&per_page=100&page='+page+'&sort=created&order=desc');if(data.incomplete_results)throw Error('Incomplete search; preserving previous snapshot');total=data.total_count;if(total>1000)throw Error('Search exceeds 1000; split query before updating');results.push(...data.items);if(results.length>=total)break;}return {total,items:results};}
const repos=[];for(let p=1;;p++){const batch=await get(`/users/${owner}/repos?type=owner&per_page=100&page=${p}`);repos.push(...batch.filter(r=>!r.private&&!r.fork&&r.name!==owner));if(batch.length<100)break;}
const all=await search(`is:pr is:public author:${owner}`);
const merged=await search(`is:pr is:public is:merged author:${owner}`);
const windowPRs=all.items.filter(p=>new Date(p.created_at)>=start&&new Date(p.created_at)<end);
const buckets=Array.from({length:12},(_,i)=>({from:new Date(start.getTime()+i*7*86400000).toISOString().slice(0,10),opened:0}));
for(const p of windowPRs){const i=Math.floor((new Date(p.created_at)-start)/(7*86400000));buckets[i].opened++;}
const external=merged.items.filter(p=>p.repository_url.split('/').at(-2).toLowerCase()!==owner);
const data={updated_at:now.toISOString(),scope:'Public GitHub only. Original public repositories exclude the profile repository. Pull requests are authored by rudevv. Weekly bins are UTC.',sources:[`https://api.github.com/users/${owner}/repos`,`https://github.com/pulls?q=is%3Apr+is%3Apublic+author%3A${owner}`],repositories:repos.length,public_pull_requests:all.total,merged_public_pull_requests:merged.total,merged_external_pull_requests:external.length,window_start:start.toISOString(),window_end_exclusive:end.toISOString(),weekly_opened_pull_requests:buckets};
await fs.mkdir('data',{recursive:true});await fs.mkdir('assets',{recursive:true});
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
for(const theme of ['dark','light']){
const d=theme==='dark',bg=d?'#101017':'#f5f3fa',fg=d?'#f5f2ff':'#171423',muted=d?'#a9a2bc':'#625975',line=d?'#292333':'#ddd6e8',accent=d?'#c3a5ff':'#7442c8';
const max=Math.max(1,...buckets.map(b=>b.opened));
const tiles=[['PUBLIC REPOS',data.repositories],['PULL REQUESTS',all.total],['MERGED PRs',merged.total],['EXTERNAL MERGES',external.length]].map(([label,n],i)=>`<g transform="translate(${32+i*290} 66)"><text fill="${muted}" font-size="12" letter-spacing="1.5">${label}</text><text y="54" fill="${fg}" font-family="Arial,Helvetica,sans-serif" font-size="43" font-weight="700">${n}</text></g>`).join('');
const bars=buckets.map((b,i)=>{const x=60+i*94,h=b.opened/max*105;return `<g><title>Week of ${b.from}: ${b.opened} public pull requests opened</title>${h?`<rect x="${x}" y="${320-h}" width="36" height="${h}" rx="4" fill="${accent}"/>`:`<circle cx="${x+18}" cy="320" r="3" fill="${muted}"/>`}<text x="${x+18}" y="344" text-anchor="middle" fill="${muted}" font-size="11">${b.from.slice(5).replace('-','/')}</text><text x="${x+18}" y="${Math.min(307,310-h)}" text-anchor="middle" fill="${fg}" font-size="12">${b.opened}</text></g>`;}).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="405" viewBox="0 0 1200 405" role="img"><title>Public GitHub activity for rudevv as of ${now.toISOString().slice(0,10)}</title><rect width="1200" height="405" rx="12" fill="${bg}"/><g font-family="Consolas,monospace">${tiles}<path d="M32 150H1168" stroke="${line}"/><text x="32" y="183" fill="${accent}" font-size="13" letter-spacing="2">PULL REQUESTS OPENED / 12 WEEKS</text><path d="M40 320H1160" stroke="${line}"/>${bars}<text x="32" y="384" fill="${muted}" font-size="11">PUBLIC DATA ONLY</text><text x="1168" y="384" text-anchor="end" fill="${muted}" font-size="11">UPDATED ${now.toISOString().slice(0,10).replaceAll('-','/')} UTC</text></g></svg>`;
await fs.writeFile(`assets/activity-${theme}.svg`,svg);
}
await fs.writeFile('data/activity.json',JSON.stringify(data,null,2)+'\n');
const rows=external.slice(0,5).map(p=>`<tr><td>${esc(p.repository_url.split('/').slice(-2).join('/'))}</td><td><a href="${p.html_url}">${esc(p.title)}</a></td><td>Merged</td></tr>`).join('\n');
const block=rows?`<table>\n<tr><th>Project</th><th>Contribution</th><th>Status</th></tr>\n${rows}\n</table>`:'My public contribution history starts here.';
const readme=await fs.readFile('README.md','utf8');
if(!readme.includes('<!-- contributions:start -->')||!readme.includes('<!-- contributions:end -->'))throw Error('Missing contribution markers');
await fs.writeFile('README.md',readme.replace(/<!-- contributions:start -->[\s\S]*?<!-- contributions:end -->/,'<!-- contributions:start -->\n'+block+'\n<!-- contributions:end -->'));
console.log(JSON.stringify({repositories:repos.length,pull_requests:all.total,merged:merged.total,external:external.length}));
