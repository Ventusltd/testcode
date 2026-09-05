import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldOfferRecovery} from './recovery.js';
test('missing app and explicit timeout offer retry; external navigation and unknown map do not',()=>{
 assert.equal(shouldOfferRecovery({interface:'unrecognised'}),true);
 assert.equal(shouldOfferRecovery({interface:'loading',timedOut:'true'}),true);
 assert.equal(shouldOfferRecovery({interface:'loaded',drawing:'unreported'}),false);
 assert.equal(shouldOfferRecovery({interface:'unavailable',drawing:'unreported'}),false);
 assert.equal(shouldOfferRecovery({interface:'loaded',drawing:'ready'}),false);
});
