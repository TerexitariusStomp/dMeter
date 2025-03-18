# Data claim resolution NFT



[Original Github Post Here ](https://github.com/filecoin-project/devgrants/issues/1050)

Data Claim Resolution NFT

Overview

dMeter aims to revolutionize the way decentralized Measurement, Reporting, and Verification (dMRV) protocols operate in the field of regenerative action and ecosystem regeneration. By providing a platform for independent dMRV providers and organizations to collaborate, we strive to create a more accessible and trust-minimized data collection, analysis, and reporting environment. Our platform is built on a secure, transparent, and scalable decentralized infrastructure.

Project Description

dMeter is an innovative solution that unites protocols and primitives for the storage and resolution of environmental claims. Our comprehensive framework is designed to efficiently handle data collection, storage on IPFS, cross-referencing and resolving claims, governance, and integration with other decentralized systems. By developing and adopting standardized data schemas dMeter ensures compatibility and ease of integration with various dMRV tools.

The project brings together established players in the space, including Regen Network (EcoCredit module and Data Module), Silvi (tree MRV and stewardship protocol), Eco Labs (Reputation and ID protocol), and Athena Protocol (Ocean Protocol middleware-like Provider). The grant will support the development of integrations and interoperability among these projects directly, as well as consulting with and encouraging the open inclusion of additional projects, fostering collaboration among many independent dMRV providers and organizations.

Although our initial focus is on reforestation, dMeter serves as a proof of concept for a broader claim resolution and transaction settlement system. This platform is designed to facilitate the resolution of a broad range of claims which preserves the provenance of data, protects individual data ownership, and encourages the equitable flow of open data.

By leveraging web3 technology and a decentralized governance model, dMeter enables stakeholders to propose and vote on changes to the framework, schemas, and other system components.

dMeter's innovative approach to creating a decentralized space for collaboration among separate, independent dMRV providers and organizations has the potential to transform the regenerative action and ecosystem regeneration landscape. By harnessing the power of IPFS and fostering collaboration and interoperability between dMRV organizations of all types.

Deliverables

Total Funding Amount: List the total proposed funding amount in USD, eventually can be a distribution between USD/FIL

Milestones: Please specify 2-3 milestones for your project, with associated funding amounts.

\#dMeter#

dMeter Stewards will facilitate workshops, consultations, and strategy sessions focused on how member organization can pursue interoperability standards & data schemas regarding:

Data Collection and Standardization

Develop standardized data schemas for different types of ecological claims. For instance, create distinct schemas for trees, geolocation, and regenerative project types.

Encourage dMRV tool creators to adopt these standardized schemas to ensure compatibility and ease of data aggregation.

Ensure that all data collected by dMRV tools include essential metadata, such as timestamps, geolocation, and device information to enhance the claim verification process.

Data Storage on IPFS:

Store collected data on IPFS, leveraging its content-addressing and distributed nature. Assign each data item a unique CID to ensure data integrity and tamper resistance, leveraging existing frameworks such as co2.storage

Create a directory structure or a decentralized database to index and organize the data efficiently, making it easier to locate and cross-reference claims.

Coordination of dMeter Member Integrations:

Athena Protocol integration for dMRV data monetization & claims resolution

Silvi for Human-sensing & Tree Forwards claim models

Regen Network for connecting resolved claims to Eco Credit origination

Eco Labs for Reputation-sensing & interoperable Regenerator IDs

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

Athena Protocol Middleware

Athena is building a claims resolution layer with 3 Primitive Contracts.

PolicyNFT (AlgoNFT )

ProgenitorNFT ( DataNFT )

ClaimNFT ( MetaDataNFT )

The Primitives under development will enable various forms of interaction, with the primary focus being the establishment of a multiparty verification system for claims related to environmental impact. A prime example of a policy or claim applicable to this workflow is a sustainability-linked loan or bond. The process flow chart provided illustrates the interaction between the three contracts and IPFS in the proposed architecture.

In this proposed architecture, the Progenitor receives funds through a sustainability-linked loan or bond contract, while the Broker serves as the issuer of the sustainability-linked loan or bond. The Auditor, as a third party, is tasked with monitoring, reporting, and verification.

IPFS will support both data storage and hash proof generation, connecting on-chain assets and claims to off-chain data sources and registries. Future integrations with Filecoin are planned.

Preliminary scoping, design, and consultation for a decentralized Monitoring, Reporting, and Verification (MRV) interoperable metadata schema have already taken place. The schema will accommodate both verifiable claims and open comments on the data sources and audit mechanisms employed in claim verification. The MetaDataNFT will function as a versatile base contract that organizations committed to open and decentralized MRV can utilize in numerous ways.

The resulting application-specific blockchain from this development will enable fully interoperable MRV data flows while preserving provenance, supporting additionality, and generating secondary revenue for MRV stakeholders.

Examples:

Inter Organizational Data Transactions

Silvi aggregates tree data sources into a DataNFT and permits dMeter organizations to purchase access to the source data for free so long as they are training an approved computer vision model. Themistoklis then purchases Silvi’s MRV to train a computer vision model. The final model is published as an AlgoNFT. Themistoklis permits dMeter organizations to utilize their algorithm at an exclusive rate.

Inner Organizational Data Transactions

Silvi users submit tree data as DataNFT. Silvi uses a 3rd party audit published as AlgoNFT, and the users DataNFT to construct a MetaDataNFT contract. The metaDataNFT will log the results of all audits conducted on the users source data. Users are rewarded for tree planting based on the state of their claims reflected in the metadataNFT.

Inner to Inter Organization Data Transactions

Silvi users submit tree data which is used to verify a claim as stated in the previous example. Themistoklis wants to purchase access to Silvi tree data in order to train a computer vision model as in the first example. Silvi asks users to authorize a new service level access agreement for their source data that allows the data to be sold for the expressly stated purpose and uses a community voting process to determine the cost of access. Users who opt out will not be affected by the new data sharing arrangement.

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

Silvi

Silvi

Silvi is building coordination and financial tools to help a billion people plant a trillion trees. Having developed a WebApp MVP that registers and logs human-sensed ground truth, Silvi’s next steps are:

Bring tree data, metadata and claims to IFPS. Silvi users would be the progenitors of tree data and metadata such as photos, attribution claims, form fields etc

Develop data NFT with a tree model (for minted trees) that fetches pinned data and claims history stored via IPFS. Incorporate as much as possible into co2.storage

Run at least 1 methodology against the tree model (ideally incorporate co2.storage schema). Current models being developed or in the pipeline include:

Claim model - allometric and logistical methodology

Tree Forward model for programmable tranche sequence and size tied to the claim model

Claim settlement model starting with God mode but ultimately becoming decentralized and distributed. Think the role of a Validation and Verification Body (VVB) but via claim review randomization, verification optimizations, reputation techniques such as trust scores, probability-based confidence around outcomes of claims etc

Active inference model such as with machine learning and computer vision, object detection, compute-over-data (such as Bacalhau) etc

Proof of concept: Silvi’s level of detail on individual trees, species-based wikis, and participatory records support the theory of change that reforestation requires community effects to scale, tree-intelligence for modeling and collateralization, as well as traceability/tracking for performance-based payouts and transparent ROI. Further, while Silvi is focusing on reforestation, there are other complimentary regenerative activities such as bee keeping, soil testing, remote sensing, complementary crops etc that can be stacked on top of reforestation logistics of the regenerator that require interoperability, geospatial queering and independently verified proof of location, solutions offered via other protocols

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

Regen Network

Utilize existing Regen Network functionality (minimum dev work, mostly alignment / consultation calls): For this we can utilize existing functionality of Regen Networks' data module, and simply register IPFS hashes as a resolver on Regen Network. This enables us to leverage Regen Network's attestation system for allowing digital signatures on hashed documents, and does not require any new work on Regen Ledger. In this scope, we would be happy to support with writing scripts / tools, and consulting on devoops/operationalizing of any Regen Network integration.

Upgrade Regen Network Data Module to explicitly support IPFS as a storage layer (medium dev work): This tier would include a mechanism for us explicitly supporting IPFS as a storage layer for datasets anchored on Regen Network. It requires us defining standards for canonical bijective mapping between Regen IRI's and IPFS CID's, and likely supporting explicit metadata on anchored datasets that indicate if they are available on IPFS. This requires the RND team to scope & design new functionality into our data module, and implement the necessary upgrades on Regen Ledger.

Upgrade Regen Network Data Module with full IPLD (nested JSON-LD data) support using IPFS as a resolver: One main interoperability challenge with different hashing systems is how to deal with nested datasets where a CID or Regen IRI may be present as elements inside given JSON-LD dataset. Regen Network and Filecoin Green are both interested in continuing to research interoperability at this level, but it is likely not something that can be expected to be fully delivered within the scope of this grant.

Eco Labs

Eco Labs

Eco Labs (EL) is helping people on-board and get connected at a bioregional level, experimenting with “Reputation-sensing” using a Bioregional Passport (similar to Gitcoin Passport), and weaving together dMeter dMRV solutions into a novel practice-based Adaptive Agroforestry & Smallholder Stewardship methodology built on Regen Network.

Features and Integrations:

User Experience: EL offers a seamless onboarding experience, allowing users--or “Regenerators”--to obtain a Bioregional Passport without cumbersome web3 UX barriers, and guiding them into opportunities to take regenerative action.

Decentralized Identifiers: EL employs Decentralized Identifiers (DIDs) for people, projects, local organizations, & global/technology platforms

Silvi Integration: With seamless connectivity to Silvi, users can effortlessly apply Silvi's methodology to their projects, fostering synergistic collaboration between the two platforms.

Verifiable Relationship & Associations: EL should be able to enable entities to issue verifiable credentials about which associations exist between various entities. This could be like "X has a profile on Silvi", "Y is registered with EL", “Z is a part of a local farming co-op” etc.

dMRV based Eco Credits Issuance: Upon successful completion of project methodologies & dMeter framework integration with Regen Network, EL will issue eco credits, rewarding smallholder farmers for their contributions to environmental sustainability using a completely decentralized & dMRV based eco asset origination process.

Integration:

1.) Bring tree data on-chain. Silvi and users would be the progenitors of tree data and metadata such as photos, attributes, agent informations.

2.) Evaluate the feasibility of bringing high resolution imagery to defined zones on chain to render on Silvi’s GIS app via polygon and map tiles

2.) Develop auditing methodologies (human and AI) via randomization, verification optimizations, reputation techniques, probability-based confidence around outcomes of claims for trees (tree stewardship and tree performance)

Team Experience

Athena Protocol : Timothy Carter

CEO & Environmental Data Scientist

timothy@athena.tech

Silvi Protocol: Djimo Serodio

Founder and CEO of Silvi and JustLearn (Background in environmental science, agriculture and citizen science frameworks)

djimo@silvi.earth

Avano : Thomas Price :

Founder & Regenerative Crypto Economics Phd

hardwoodstablecoin@gmail.com

EcoLabs : Sev Nightingale

Founder and CEO

sevnightingale@gmail.com
