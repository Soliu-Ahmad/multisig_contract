
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("MultiSig Contract Tests", function () {

 
    async function deployMultiSigFixture() {
        const [owner, signer1, signer2, nonSigner] = await ethers.getSigners();
        
        const validSigners = [owner.address, signer1.address, signer2.address];
        const quorum = 2;
        const initialBalance = ethers.parseEther("10");

        const MultiSig = await ethers.getContractFactory("MultiSig");
        const multiSig = await MultiSig.deploy(validSigners, quorum, { value: initialBalance });

        return { multiSig, owner, signer1, signer2, nonSigner, quorum };
    }

    describe("Deployment", function () {
        it("Should deploy with the correct initial state", async function () {
            const { multiSig, owner, signer1, signer2 } = await loadFixture(deployMultiSigFixture);
            
       
            const balance = await ethers.provider.getBalance(multiSig.target);
            expect(balance).to.equal(ethers.parseEther("10"));

     
            const registeredSigners = [owner.address, signer1.address, signer2.address];
            for (let i = 0; i < registeredSigners.length; i++) {
                expect(await multiSig.signers(i)).to.equal(registeredSigners[i]);
            }
        });
    });

    describe("Transaction Management", function () {
        it("Should allow valid signer to initiate a transaction", async function () {
            const { multiSig, signer1, signer2 } = await loadFixture(deployMultiSigFixture);
            
            const amount = ethers.parseEther("1");
            await multiSig.connect(signer1).initiateTransaction(amount, signer2.address);

            const transactions = await multiSig.getAllTransactions();
            const tx = transactions[0];
            
            expect(transactions.length).to.equal(1);
            expect(tx.amount).to.equal(amount);
            expect(tx.receiver).to.equal(signer2.address);
            expect(tx.signersCount).to.equal(1);
        });

        it("Should revert if a non-signer initiates a transaction", async function () {
            const { multiSig, nonSigner, signer1 } = await loadFixture(deployMultiSigFixture);
            
            const amount = ethers.parseEther("1");
            await expect(
                multiSig.connect(nonSigner).initiateTransaction(amount, signer1.address)
            ).to.be.revertedWith("not valid signer");
        });

        it("Should execute a transaction upon reaching quorum", async function () {
            const { multiSig, owner, signer1, signer2 } = await loadFixture(deployMultiSigFixture);
            
            const amount = ethers.parseEther("1");
            const initialBalance = await ethers.provider.getBalance(signer2.address);
            
            await multiSig.connect(owner).initiateTransaction(amount, signer2.address);
            await multiSig.connect(signer1).approveTransaction(1);

            const finalBalance = await ethers.provider.getBalance(signer2.address);
            expect(finalBalance.sub(initialBalance)).to.equal(amount);
        });

        it("Should prevent double-signing by the same signer", async function () {
            const { multiSig, signer1, signer2 } = await loadFixture(deployMultiSigFixture);
            
            await multiSig.connect(signer1).initiateTransaction(ethers.parseEther("1"), signer2.address);
            
            await expect(
                multiSig.connect(signer1).approveTransaction(1)
            ).to.be.revertedWith("can't sign twice");
        });
    });

    describe("Ownership Management", function () {
        it("Should allow owner to transfer and claim ownership", async function () {
            const { multiSig, owner, signer1 } = await loadFixture(deployMultiSigFixture);
            
      
            await multiSig.connect(owner).transferOwnership(signer1.address);
            await multiSig.connect(signer1).claimOwnership();

        
            const newSignerAddress = "0x0D33Ee49A31FfB9B579dF213370f634e4a8BbEEd";
            await multiSig.connect(signer1).addValidSigner(newSignerAddress);
            
        
            await expect(
                multiSig.connect(owner).addValidSigner(newSignerAddress)
            ).to.be.revertedWith("not owner");
        });

        it("Should revert if non-owner attempts ownership transfer", async function () {
            const { multiSig, signer1, signer2 } = await loadFixture(deployMultiSigFixture);
            
            await expect(
                multiSig.connect(signer1).transferOwnership(signer2.address)
            ).to.be.revertedWith("not owner");
        });
    });

    describe("Signer Management", function () {
        it("Should allow owner to add and remove signers", async function () {
            const { multiSig, owner, nonSigner } = await loadFixture(deployMultiSigFixture);
            
   
            await multiSig.connect(owner).addValidSigner(nonSigner.address);
            
   
            await multiSig.connect(nonSigner).initiateTransaction(ethers.parseEther("1"), owner.address);


            await multiSig.connect(owner).removeSigner(3); 
            
            await expect(
                multiSig.connect(nonSigner).initiateTransaction(ethers.parseEther("1"), owner.address)
            ).to.be.revertedWith("not valid signer");
        });
    });
});
