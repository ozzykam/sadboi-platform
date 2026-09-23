# Print-file handoff and proof approval

Updated September 21, 2026.

Purchase orders now include a **Print-file handoff & proofs** section. It uses ready private artwork assets as the source file, then records a SKU-specific proof version, handoff status, notes, and approval history.

Workflow:

1. Upload a ready private artwork image under the linked artwork.
2. Open a purchase order and choose **Add proof update**.
3. Select the order SKU, source artwork asset, version number, and status.
4. Use **Sent to supplier** when the file was handed off, **Changes requested** when corrections are needed, and **Approved** only after the supplier proof is accepted.
5. Create a new version when the file changes. Approving a newer version automatically marks the older approved version as superseded.

The server verifies that the asset belongs to the product artwork and that the SKU is on the purchase order. Proof records do not receive stock, place orders, or communicate with suppliers. File uploads currently use the existing private artwork asset workflow; external supplier delivery, signed approvals, and PDF/PSD processing remain future work.
