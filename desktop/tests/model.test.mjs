import test from 'node:test';
import assert from 'node:assert/strict';
import {activities,initialDocuments,webApps,searchItems,safeLoad,compareVersions,updateDecision} from '../web/model.mjs';
test('search finds a document by its words and identifies its type',()=>{
  const results=searchItems('spring bulbs',initialDocuments);
  assert.equal(results.length,1);
  assert.equal(results[0].name,'Notes for the garden');
  assert.equal(results[0].type,'Document');
});
test('search finds ordinary activity names and ignores whitespace',()=>{
  assert.equal(searchItems(' EMAIL ',initialDocuments)[0].id,'email');
  assert.deepEqual(searchItems('  ',initialDocuments),[]);
  assert.deepEqual(searchItems('not-found-1234',initialDocuments),[]);
});
test('unavailable or corrupt storage recovers to a usable default',()=>{
  const fallback={scale:1};
  for(const storage of [{getItem(){throw Error('Unavailable')}},{getItem(){return '{bad'}},{getItem(){return null}}]){
    assert.deepEqual(safeLoad(storage,'settings',fallback),fallback);
  }
});
test('the app store lists the real apps people already know',()=>{
  const names=webApps.map(app=>app.name);
  for(const expected of ['YouTube','Instagram','Facebook','Gmail','Netflix','Spotify','Wikipedia']){
    assert.ok(names.includes(expected),`${expected} is missing from the app store`);
  }
  assert.ok(webApps.every(app=>app.id&&app.name&&app.description&&app.category));
  assert.ok(webApps.every(app=>/^https:\/\//.test(app.url)),'every app opens a secure website');
  assert.ok(webApps.every(app=>!app.icon||typeof app.icon==='string'));
});
test('search finds an app as well as an activity and a document',()=>{
  const app=searchItems('youtube',initialDocuments);
  assert.equal(app[0].name,'YouTube');
  assert.equal(app[0].type,'App');
  assert.ok(activities.some(activity=>activity.id==='documents'));
});
test('versions compare in release order',()=>{
  assert.equal(compareVersions('0.4.0','0.4.1'),-1);
  assert.equal(compareVersions('v0.5','0.4.9'),1);
  assert.equal(compareVersions('1.0.0','1.0'),0);
  assert.equal(compareVersions('0.10.0','0.9.9'),1);
});
test('the update decision follows the release manifest',()=>{
  assert.equal(updateDecision('0.4.0',{latest:'0.5.0'}).update,true);
  assert.equal(updateDecision('0.4.0',{latest:'0.4.0'}).update,false);
  assert.equal(updateDecision('0.5.0',{latest:'0.4.0'}).update,false);
  const required=updateDecision('0.2.0',{latest:'0.5.0',minimum:'0.3.0'});
  assert.equal(required.update,true);
  assert.equal(required.required,true);
  assert.equal(updateDecision('0.4.0',{}).unknown,true);
});
