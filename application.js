const {PRE, PREClient, PREProxy} = require("./pf-pre");
const crypto = require("crypto-browserify");

const L0 = 32; // longest byte size can be encrypted
const L1 = 16; // customized length

// SECP256K1 is used for public-key cryptography which is also used in both Ethereum and Bitcoin
PRE.init(L0, L1, PRE.CURVE.SECP256K1).then(() => {
  const DataOwner = new PREClient(); // Data Owner
  const DataConsumer = new PREClient(); // authorised service provider
  const ThirdParty = new PREClient(); // unauthorised thirdparty

  // M is personal information owned by Data Owner which is a private message to be shared with Data Consumer
	// Curerntly, Proxy Encryption scheme is only suitable for a short message which should be no longer than L0
	// The message M is usually an AES key used in symmetric encryption
  const M = crypto.randomBytes(L0);
  DataOwner.keyGen();
  DataConsumer.keyGen();
  ThirdParty.keyGen();
  const pkDO = DataOwner.getPk();
  const pkDC = DataConsumer.getPk();

  // Testcase 1: Data Owner encrypts and decrypts its private message on its own
  const c1 = DataOwner.enc(M, {transformable: true});
  const [valid1, d1] = DataOwner.dec(c1);
  console.log("Data Owner Decrypts [transformable]:", valid1, "Same with plaintext?:", d1.equals(M));


  // Testcase 2: Data Owner shares c1 to Data Consumer through the proxy Proxy, then Data Consumer can decrypt
  // Processes: 
	//			(1) M is already encrypted (using Data Owner's pubkey) and stored at Proxy
	//			(2) Data Owner allows to share its private data (M) with Data Consumer.
	//			(3) Data Owner calculates the Re-encryption key (reKey) using its private key and Data Consumer's public key
	//					and sends this reKey to Proxy
  //      (4) Proxy re-encrypts the encrypted message enc(M) and transfer the re-encrypted ciphertext to Data Consumer
  //			(5) Data Consumer can decrypt the re-encrypted ciphertext using Data Consumer's private key.

  const reKey = DataOwner.reKeyGen(pkDC);
  const [valid2, c2] = PREProxy.reEnc(c1, reKey, pkDO);
  console.log("ReEncrypted ciphertext generated by Proxy:", valid2);
  const [valid3, d2] = DataConsumer.dec(c2);
  console.log("Data Consumer Decrypts the re-encrypted ciphertext:", valid3, "Same with plaintext?:", d2.equals(M));

  // Testcase 3: ThirdParty (others) cannot decrypt
  console.log("Unauthorised ThirdParty Decrypts the re-encrypted ciphertext:", ThirdParty.dec(c2)[0]);

  // Testcase 4: sign and verify
  const sig = DataOwner.sign(M);
  const verified = PREClient.verify(M, sig, pkDO);
  console.log("Signature verified:", verified);

  // Testcase 5: message that cannot be shared
  // usecase: Data Owner wants to encrypt private information with no intention of sharing
  const c3 = DataOwner.enc(M, {transformable: false});
  const [valid4, d3] = DataOwner.dec(c3);
  console.log("DataOwner Decrypts [non-transformable]:", valid4, "Same with plaintext?:", d3.equals(M));
  const [valid5, c4] = PREProxy.reEnc(c3, reKey, pkDO);
  console.log("ReEncrypt: Should be error:", valid5); // cannot reEnc non-transformable ciphertext

}).catch(r => {
  console.log(r)
});
