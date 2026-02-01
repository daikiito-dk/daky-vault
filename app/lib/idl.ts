import type { Idl } from '@coral-xyz/anchor';

export const IDL = {
  "address": "6SVBFPT8bLcbp8eDud9ECSoVYJhzmXxgHm9iU5FviKAs",
  "metadata": { 
    "name": "daky_contract", 
    "version": "0.1.0", 
    "spec": "0.1.0" 
  },
  "instructions": [
    {
      "name": "initialize",
      "discriminator": [175, 175, 109, 31, 13, 152, 155, 237],
      "accounts": [
        { "name": "globalState", "writable": true },
        { "name": "user", "writable": true, "signer": true },
        { "name": "systemProgram", "writable": false }
      ],
      "args": [
        { "name": "maxStake", "type": "u64" }, 
        { "name": "rewardRate", "type": "u64" }
      ]
    },
    {
      "name": "stake",
      "discriminator": [206, 176, 202, 18, 200, 209, 179, 108],
      "accounts": [
        { "name": "globalState", "writable": false },
        { "name": "userState", "writable": true },
        { "name": "user", "writable": true, "signer": true },
        { "name": "systemProgram", "writable": false }
      ],
      "args": [{ "name": "amount", "type": "u64" }]
    },
    {
      "name": "unstake",
      "discriminator": [191, 161, 103, 159, 64, 92, 14, 77],
      "accounts": [
        { "name": "userState", "writable": true },
        { "name": "user", "writable": true, "signer": true }
      ],
      "args": [{ "name": "amount", "type": "u64" }]
    }
  ],
  "accounts": [
    { "name": "GlobalState", "discriminator": [163, 46, 74, 6, 137, 4, 123, 226] },
    { "name": "UserState", "discriminator": [72, 177, 85, 249, 76, 167, 186, 126] }
  ],
  "types": [
    {
      "name": "GlobalState",
      "type": { 
        "kind": "struct", 
        "fields": [
          { "name": "maxStake", "type": "u64" }, 
          { "name": "rewardRate", "type": "u64" }
        ] 
      }
    },
    {
      "name": "UserState",
      "type": { 
        "kind": "struct", 
        "fields": [
          { "name": "stakedAmount", "type": "u64" }, 
          { "name": "lastStakeTime", "type": "i64" }
        ] 
      }
    }
  ],
  "errors": [
    { "code": 6000, "name": "OverMaxStake", "msg": "Exceeds maximum stake limit." },
    { "code": 6001, "name": "InsufficientFunds", "msg": "Insufficient staked amount." }
  ]
} as const satisfies Idl;