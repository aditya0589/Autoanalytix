# Autoanalytix Bring Your Own Cloud (BYOC) Architecture & Technical Specification

> **Document Type:** System Architecture & Implementation Blueprint  
> **Feature:** User-Owned Cloud Storage & Zero-Retention Data Plane (BYOC / BYOS)  
> **Primary Goal:** Eliminate platform storage liability and give enterprise & security-conscious users 100% data sovereignty by storing all analytical assets in their own cloud accounts (AWS S3, GCP Cloud Storage, Azure Blob).  
> **Status:** Architecture Proposal & Design Specification

---

## 1. Executive Summary & Problem Statement

### 1.1 The Challenge
In the default SaaS model of Autoanalytix, user datasets (CSV, Excel, Parquet), analytical caches, and database entries are stored in the platform owner's central cloud infrastructure (e.g., central AWS S3 bucket `autoanalytix-storage-prod`). 

While convenient for onboarding, this presents major blockers for enterprise, regulated, and security-minded users:
1. **Compliance & Regulatory Barriers:** HIPAA, SOC 2, ISO 27001, and GDPR often prohibit uploading raw company data to third-party vendor-owned storage buckets.
2. **Data Sovereignty:** International clients need data physically located in specific regions (e.g., `eu-central-1` or `ap-south-1`).
3. **Security & Control Anxiety:** Customers want an immediate "kill switch" where revoking platform access instantly locks the vendor out of all data.
4. **Cloud Cost & Storage Egress:** Central storage places storage billing burdens onto the SaaS operator rather than passing natural storage costs to high-volume users.

### 1.2 The Solution: Bring Your Own Cloud (BYOC / BYOS)
Autoanalytix will introduce **User-Managed Cloud Storage (BYOS)**:
- **Zero Data-at-Rest in Platform Storage:** All uploaded raw files, converted Parquet datasets, analytical snapshots, and reports are written directly to and read strictly from the **customer's own cloud bucket**.
- **Cross-Account IAM Role Delegation (No Static Keys):** Authentication uses temporary, cryptographic STS token assumption with unique workspace `ExternalId` parameters—completely eliminating vulnerable long-lived API keys.
- **Client-Side Direct Uploads (Zero-Data-Transit Option):** The browser streams files directly to the customer's cloud bucket via presigned URLs.
- **Instant Revocability:** The customer can revoke Autoanalytix's access at any second from their own AWS/GCP/Azure management console.

---

## 2. High-Level System Architecture

```mermaid
flowchart TD
    subgraph Customer_Cloud ["Customer Cloud Account (e.g., AWS Account 111122223333)"]
        CustomerBucket[("Customer S3 Bucket\n(my-company-autoanalytix)")]
        CustomerKMS["Customer KMS Key (CMK)\n(Client-Controlled Encryption)"]
        CustomerRole["IAM Role: AutoanalytixStorageAccessRole\n(Trusts Autoanalytix Account + ExternalId)"]
        
        CustomerRole -->|Grants S3 / KMS Access| CustomerBucket
        CustomerKMS -->|Encrypts Objects at Rest| CustomerBucket
    end

    subgraph Autoanalytix_Backend ["Autoanalytix SaaS Backend (AWS Account 123456789012)"]
        API["FastAPI Backend / Lambda\n(autoanalytix-backend)"]
        StorageFactory["Dynamic Storage Factory\n(Resolves Workspace Storage Mode)"]
        STSService["AWS STS Client\n(sts:AssumeRole)"]
        DuckDBEngine["DuckDB Engine\n(Ephemeral In-Memory / /tmp Execution)"]
        MetadataDB["Metadata Store\n(Dataset Schemas & Column Stats)"]

        API --> StorageFactory
        StorageFactory --> STSService
        API --> DuckDBEngine
        API --> MetadataDB
    end

    subgraph Customer_Browser ["Customer User Browser"]
        WebApp["Autoanalytix Frontend\n(React + Vite)"]
    end

    %% Flow 1: Setup
    CustomerRole -.->|1. Configures Trust Policy| STSService

    %% Flow 2: Ingestion via Presigned URL
    WebApp -->|2. Request Presigned URL| API
    API -->|3. Assume Customer Role & Gen Presigned PUT| STSService
    STSService -->|4. Temporary Scoped Credentials| CustomerBucket
    WebApp -->|5. Uploads File Directly (Zero-Transit)| CustomerBucket

    %% Flow 3: Analytics Execution
    WebApp -->|6. Execute Natural Language Query| API
    API -->|7. Stream Parquet via Assumed Role into /tmp| DuckDBEngine
    DuckDBEngine -->|8. Run Analytical SQL Query| API
    DuckDBEngine -.->|9. Immediately Flush Ephemeral /tmp Cache| DuckDBEngine
    API -->|10. Return Aggregated Results / Charts| WebApp
```

---

## 3. Storage Operational Models: Optional Opt-In vs Default Platform Storage

### 3.1 Strict Opt-In Philosophy
To prevent onboarding friction for casual users, **this feature is 100% optional**:
- **Default Experience (`PLATFORM_DEFAULT`):** Every new user and workspace defaults to standard Autoanalytix managed storage (S3 bucket `autoanalytix-storage-prod`). Users can sign up, drag-and-drop a CSV or Excel file, and get immediate charts and AI analytics without ever knowing what AWS or S3 is.
- **Privacy Mode (`BYOS_AWS_S3`):** Only users with strict compliance requirements, enterprise mandates, or personal privacy preferences need to visit **Workspace Settings -> Cloud Storage** and configure their own AWS account.

### 3.2 Feature Comparison Matrix

| Capability | Standard Managed Mode (Default / Zero Config) | Bring Your Own Storage (Optional Privacy Mode) |
| :--- | :--- | :--- |
| **Who is it for?** | Casual users, students, quick prototypes, internal demos | Enterprise teams, regulated industries, privacy-conscious users |
| **Setup Required** | **Zero Setup (Instant 1-Click Onboarding)** | ~3 minutes (deploy 1-click CloudFormation stack or input S3 bucket) |
| **Storage Location** | Autoanalytix Central S3 Bucket | Customer's Private Cloud Bucket (AWS S3 / GCS / Azure) |
| **Data Ownership** | Managed on platform infrastructure | **100% Owned & Controlled by Customer** |
| **AWS Costs** | Included with Autoanalytix subscription | Storage billed directly to customer's AWS account |
| **Credential Mechanism** | Internal platform IAM | **AWS STS AssumeRole + ExternalId (No secrets stored)** |
| **Encryption Keys** | Platform AWS KMS default | **Customer Managed Key (CMK) in Customer's AWS KMS** |
| **Data Retention on SaaS** | Encrypted Parquet on S3 | **Zero storage at rest** (Ephemeral compute only) |
| **Revocation** | Account deletion request | **Instant 1-Click revocation** inside customer AWS console |
| **Reversibility** | Can upgrade to BYOS anytime | Can switch back to Platform Managed storage anytime |

### 3.3 Switching Between Storage Modes
Workspaces can switch between modes at any time in **Settings**:
1. **Upgrading to BYOS:**
   - When a workspace switches from **Platform Default** to **BYOS**, all **new** datasets are immediately stored in the customer's private bucket.
   - An optional **"Migrate Existing Datasets to My Cloud"** button can automatically transfer existing historical datasets from the platform bucket into their private bucket and purge them from the platform bucket.
2. **Reverting to Platform Default:**
   - If a customer deletes their AWS bucket or wants to switch back, they can toggle back to Platform Default with 1 click.


---

## 4. Security & Authentication Architecture

A core design principle is **Zero Long-Lived Static Secrets**. Autoanalytix should **never** request or store a customer's `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY`. Storing root or IAM user credentials creates high security liability.

Instead, we employ the **Cross-Account IAM Role Assumption Pattern** (the same model used by Datadog, Snowflake, and AWS Partner integrations).

### 4.1 Cross-Account IAM Role with External ID
To prevent the **Confused Deputy Problem** (where an attacker tries to trick the service into accessing another customer's resources), every Autoanalytix workspace is assigned a cryptographically unique `ExternalId` (UUID v4 + workspace hash).

#### Customer CloudFormation / IAM Trust Policy:
The customer deploys an IAM Role named `AutoanalytixStorageAccessRole` in their AWS account with the following trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:role/autoanalytix-backend-role"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "aa_ws_9f83b271d44c4a6b8ef6c987a1234567"
        }
      }
    }
  ]
}
```

#### Scoped IAM Permissions Policy:
The customer attaches a least-privilege policy to this role, restricting operations to *only* the dedicated Autoanalytix prefix inside their bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AutoanalytixBucketAccess",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ],
      "Resource": "arn:aws:s3:::my-company-autoanalytix-data"
    },
    {
      "Sid": "AutoanalytixObjectAccess",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload"
      ],
      "Resource": "arn:aws:s3:::my-company-autoanalytix-data/autoanalytix/*"
    },
    {
      "Sid": "AutoanalytixKMSAccess",
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt",
        "kms:GenerateDataKey"
      ],
      "Resource": "arn:aws:kms:us-east-1:111122223333:key/customer-key-id",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "s3.us-east-1.amazonaws.com"
        }
      }
    }
  ]
}
```

---

## 5. Technical Implementation Details

### 5.1 Storage Abstraction Layer (Factory Pattern)

Currently, `backend/app/core/s3_storage.py` uses a singleton `s3_storage` instance bound to platform settings. We will refactor this to an interface with a dynamic resolver:

```python
# app/core/storage/base.py
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class BaseStorageService(ABC):
    @abstractmethod
    def upload_file(self, local_path: str, remote_key: str) -> str:
        """Uploads a local file to cloud storage."""
        pass

    @abstractmethod
    def download_file(self, remote_key: str, local_path: str) -> str:
        """Downloads a cloud object to local disk."""
        pass

    @abstractmethod
    def generate_presigned_upload_url(
        self, remote_key: str, content_type: str = "application/octet-stream", expires_in: int = 3600
    ) -> Dict[str, Any]:
        """Generates direct client upload URL."""
        pass

    @abstractmethod
    def delete_file(self, remote_key: str) -> None:
        """Deletes a cloud object."""
        pass

    @abstractmethod
    def test_connection(self) -> Dict[str, Any]:
        """Validates read, write, and delete permissions."""
        pass
```

### 5.2 Customer Assumed-Role Storage Implementation

```python
# app/core/storage/customer_s3.py
import boto3
from typing import Dict, Any
from app.core.storage.base import BaseStorageService

class CustomerS3StorageService(BaseStorageService):
    def __init__(self, role_arn: str, external_id: str, bucket_name: str, region: str = "us-east-1", prefix: str = "autoanalytix"):
        self.role_arn = role_arn
        self.external_id = external_id
        self.bucket = bucket_name
        self.region = region
        self.prefix = prefix.strip("/")
        self._s3_client = None

    def _get_assumed_client(self):
        """Assumes the customer's role via STS and obtains temporary scoped credentials."""
        sts_client = boto3.client("sts", region_name=self.region)
        assumed = sts_client.assume_role(
            RoleArn=self.role_arn,
            RoleSessionName="AutoanalytixWorkspaceSession",
            ExternalId=self.external_id,
            DurationSeconds=3600  # 1 hour lease
        )
        credentials = assumed["Credentials"]
        return boto3.client(
            "s3",
            region_name=self.region,
            aws_access_key_id=credentials["AccessKeyId"],
            aws_secret_access_key=credentials["SecretAccessKey"],
            aws_session_token=credentials["SessionToken"]
        )

    @property
    def client(self):
        if not self._s3_client:
            self._s3_client = self._get_assumed_client()
        return self._s3_client

    def _qualify_key(self, remote_key: str) -> str:
        clean = remote_key.lstrip("/")
        return f"{self.prefix}/{clean}" if not clean.startswith(self.prefix) else clean

    def upload_file(self, local_path: str, remote_key: str) -> str:
        target_key = self._qualify_key(remote_key)
        self.client.upload_file(local_path, self.bucket, target_key)
        return target_key

    def download_file(self, remote_key: str, local_path: str) -> str:
        target_key = self._qualify_key(remote_key)
        self.client.download_file(self.bucket, target_key, local_path)
        return local_path

    def generate_presigned_upload_url(self, remote_key: str, content_type: str = "application/octet-stream", expires_in: int = 3600):
        target_key = self._qualify_key(remote_key)
        url = self.client.generate_presigned_url(
            ClientMethod="put_object",
            Params={"Bucket": self.bucket, "Key": target_key, "ContentType": content_type},
            ExpiresIn=expires_in
        )
        return {"upload_url": url, "s3_key": target_key, "bucket": self.bucket, "expires_in": expires_in}

    def delete_file(self, remote_key: str) -> None:
        target_key = self._qualify_key(remote_key)
        self.client.delete_object(Bucket=self.bucket, Key=target_key)

    def test_connection(self) -> Dict[str, Any]:
        """Probes STS assumption, bucket write, read, and deletion."""
        test_key = f"{self.prefix}/_health_check.txt"
        client = self._get_assumed_client()
        # 1. Test PutObject
        client.put_object(Bucket=self.bucket, Key=test_key, Body=b"Autoanalytix Connection Probe OK")
        # 2. Test GetObject
        obj = client.get_object(Bucket=self.bucket, Key=test_key)
        content = obj["Body"].read().decode("utf-8")
        # 3. Test DeleteObject
        client.delete_object(Bucket=self.bucket, Key=test_key)
        return {"status": "healthy", "verified": True, "bucket": self.bucket, "region": self.region}
```

### 5.3 Storage Factory Resolver
Every time an API endpoint deals with a dataset (uploading, querying, downloading, or deleting), it resolves the storage service for the requesting workspace:

```python
# app/core/storage/factory.py
from app.core.config import settings
from app.core.storage.base import BaseStorageService
from app.core.storage.platform_s3 import PlatformS3StorageService
from app.core.storage.customer_s3 import CustomerS3StorageService

def get_storage_service_for_workspace(workspace_record: dict) -> BaseStorageService:
    config = workspace_record.get("cloud_storage_config")
    if not config or config.get("provider") == "PLATFORM_DEFAULT":
        return PlatformS3StorageService(bucket=settings.S3_STORAGE_BUCKET, region=settings.AWS_REGION)

    provider = config.get("provider")
    if provider == "AWS_S3":
        return CustomerS3StorageService(
            role_arn=config["role_arn"],
            external_id=workspace_record["external_id"],
            bucket_name=config["bucket_name"],
            region=config.get("region", "us-east-1"),
            prefix=config.get("prefix", "autoanalytix")
        )
    raise ValueError(f"Unsupported cloud storage provider: {provider}")
```

---

## 6. Ephemeral Compute & Privacy Guarantees

How does Autoanalytix run SQL queries without keeping customer data on the server?

1. **Streaming Execution with DuckDB:**
   - When a user asks an analytical question or runs a query, the backend Lambda retrieves only the relevant Parquet dataset from the customer's S3 bucket into `/tmp/storage/`.
   - DuckDB executes the vectorized query in milliseconds.
   - Aggregated result rows (e.g. 10 rows for a bar chart) are returned to the frontend.
2. **Post-Execution Cleanup (Zero Residual Data):**
   - After the query completes or when the Lambda container recycles, files in `/tmp` are wiped.
   - No raw customer data ever touches Autoanalytix persistent databases.
3. **Metadata Isolation:**
   - Only non-sensitive metadata (table schema, column names, column data types, and null counts for query optimization) are stored in the platform database (DynamoDB).
   - Even this metadata can be encrypted with the workspace's AES-256-GCM key.

---

## 7. Frontend User Experience (Settings -> Cloud Storage)

### 7.1 Storage Mode Selection (The Dual-Mode Toggle)
Inside **Workspace Settings -> Cloud Storage**, the user is greeted with a clear, intuitive toggle:

```plaintext
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⚙️ Cloud Storage & Data Sovereignty                                          │
│ Choose where your uploaded datasets, Parquet caches, and reports are stored.│
│                                                                             │
│  ◉ Standard Autoanalytix Cloud (Default)                                    │
│    Zero configuration required. All files are securely encrypted and stored │
│    in Autoanalytix managed AWS S3. Fast and seamless for everyday analysis.  │
│                                                                             │
│  ○ Bring Your Own Cloud (BYOS - Privacy Mode)                               │
│    Store 100% of your analytical data in your own AWS S3 bucket. Autoanalytix│
│    holds zero data at rest. Instant revocation via your AWS console.        │
└─────────────────────────────────────────────────────────────────────────────┘
```

When **Standard Autoanalytix Cloud** is selected, nothing needs to be configured. 
When the user selects **Bring Your Own Cloud**, the setup wizard expands:

### 7.2 BYOS Setup Wizard Steps
1. **Choose Provider:** Options for AWS S3 (Phase 1), Google Cloud Storage (Phase 2), Azure Blob (Phase 3).
2. **Copy External ID:** The modal generates and displays the user's secure Workspace External ID:
   `aa_ws_9f83b271d44c4a6b8ef6c987a1234567`
3. **1-Click AWS CloudFormation Deployment:**
   - We provide a *"Launch in AWS Console"* button pre-filled with the CloudFormation template URL.
   - The template automatically provisions the IAM Role with the exact trust policy and scoped permissions.
4. **Enter Bucket & Role Details:**
   - User inputs:
     - S3 Bucket Name: `my-org-analytics-vault`
     - AWS Region: `us-east-1`
     - Assumed Role ARN: `arn:aws:iam::111122223333:role/AutoanalytixStorageAccessRole`
5. **Test Connection & Save:**
   - Clicking **"Validate Connection"** executes `test_connection()` on the backend.
   - A green checkmark confirms: *"Successfully assumed role, validated read, write, and delete permissions."*
   - From that moment on, all datasets are routed directly to their own AWS account.
6. **Optional Dataset Migration Tool:**
   - A button labeled *"Transfer existing datasets to your bucket"* allows moving existing files from the platform bucket to their personal bucket.


---

## 8. Multi-Cloud Expansion (AWS, GCP & Azure)

| Cloud Provider | Identity Mechanism | Storage Target | Status |
| :--- | :--- | :--- | :--- |
| **AWS** | AWS STS `AssumeRole` + `ExternalId` | Amazon S3 | **Implemented & Verified** |
| **Google Cloud (GCP)** | Scoped Service Account JSON / `gcloud` / Terraform | Google Cloud Storage (GCS) | **Implemented & Verified** |
| **Microsoft Azure** | Container-scoped SAS Token / Connection String / Entra ID | Azure Blob Storage | **Implemented & Verified** |

---

## 9. Implementation Status

### Phase 1: Storage Layer Architecture
- [x] Create `app/core/storage/base.py` interface.
- [x] Implement `PlatformS3StorageService` (standard SaaS managed storage).
- [x] Implement `CustomerS3StorageService` with `sts:AssumeRole`.
- [x] Implement `CustomerGCSStorageService` with Google Cloud Storage client & signed URLs.
- [x] Implement `CustomerAzureBlobStorageService` with ContainerClient & SAS delegation.
- [x] Create dynamic multi-cloud `StorageFactory` resolving AWS, GCP, Azure, or Platform S3 via `workspace_id`.

### Phase 2: Connection Testing & Configuration APIs
- [x] `GET /api/workspaces/{id}/storage-config`: Retrieve current storage mode, external ID, provider, and masked connection statuses.
- [x] `POST /api/workspaces/{id}/storage-config`: Update customer cloud configuration (AWS S3, GCP GCS, Azure Blob, or Platform Default).
- [x] `POST /api/workspaces/{id}/storage-config/test`: Execute 4-step probe write/read/delete against customer AWS, GCP, or Azure storage.
- [x] `GET /api/workspaces/{id}/storage-config/cloudformation`: 1-click AWS IAM CloudFormation template generator.
- [x] `GET /api/workspaces/{id}/storage-config/gcp-script`: 1-click `gcloud` shell command script & Terraform HCL block.
- [x] `GET /api/workspaces/{id}/storage-config/azure-script`: 1-click Azure CLI scoped SAS generation script.
- [x] `POST /api/workspaces/{id}/storage-config/migrate`: Migrate existing datasets from platform storage into customer's active private cloud bucket.

### Phase 3: Frontend Settings UI & Setup Wizards
- [x] Full interactive Multi-Cloud selector (AWS, GCP, Azure) in **Workspace Settings -> Cloud Storage**.
- [x] Dedicated setup guides & parameter forms for each cloud provider.
- [x] 1-Click script & template viewers for CloudFormation, `gcloud` CLI, Terraform, and Azure CLI.
- [x] Real-time 4-step probe test with live step-by-step health badges & latency benchmark.
- [x] Instant dataset migration tool across all supported cloud providers.

