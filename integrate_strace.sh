#!/bin/bash

set -euo pipefail

# ---- CONFIG ----
WORKFLOW_DIR=".github/workflows"
YQ_BIN="$HOME/.local/bin/yq"
mkdir -p ~/.local/bin
export PATH="$HOME/.local/bin:$PATH"

echo "🔧 Starting strace injection into GitHub Actions workflows..."

# ---- INSTALL yq IF MISSING ----
if [ ! -x "$YQ_BIN" ]; then
  echo "🔍 yq not found. Installing locally..."
  OS=$(uname -s)
  case "$OS" in
    Darwin)   YQ_URL="https://github.com/mikefarah/yq/releases/latest/download/yq_darwin_amd64" ;;
    Linux)    YQ_URL="https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64" ;;
    *) echo "❌ Unsupported OS: $OS"; exit 1 ;;
  esac

  curl -sSL "$YQ_URL" -o "$YQ_BIN"
  chmod +x "$YQ_BIN"

  if ! "$YQ_BIN" --version &> /dev/null; then
    echo "❌ Failed to install a working yq binary"
    rm -f "$YQ_BIN"
    exit 1
  fi
fi

echo "✅ yq is available: $($YQ_BIN --version)"
echo "📂 Scanning directory: $WORKFLOW_DIR"

# ---- PROCESS WORKFLOW FILES ----
find "$WORKFLOW_DIR" -name '*.yml' | while read -r file; do
  echo -e "\n📄 Processing file: $file"

  # Track if upload step is injected already
  upload_step_added=false

  job_keys=$($YQ_BIN e '.jobs | keys | .[]' "$file" || true)

  for job in $job_keys; do
    echo "⚙️  Handling job: $job"
    step_count=$($YQ_BIN e ".jobs.\"$job\".steps | length" "$file")

    for ((i=0; i<step_count; i++)); do
      run_command=$($YQ_BIN e ".jobs.\"$job\".steps[$i].run" "$file")

      if [[ "$run_command" == "null" ]]; then
        echo "  ⏭️  Step[$i] has no run command. Skipping."
        continue
      fi

      if echo "$run_command" | grep -Eqi 'install'; then
        echo "  🚫 Step[$i] looks like an install command. Skipping: $run_command"
        continue
      fi

      echo "  🔄 Injecting strace into step[$i]: $run_command"

      strace_command="mkdir -p strace_logs && strace -tt -f -o strace_logs/${job}_step${i}.log bash -c $run_command"
    
      export strace_command
      $YQ_BIN -i ".jobs.\"$job\".steps[$i].run = strenv(strace_command)" "$file"
    done

    if [ "$upload_step_added" = false ]; then
      echo "📦 Adding artifact upload step to file: $file"
      export job  # ensures strenv(job) works as expected

      $YQ_BIN -i '.jobs[strenv(job)].steps += [{
      "name": "Upload strace logs",
      "uses": "actions/upload-artifact@v4",
      "with": {
        "name": "strace_logs",
        "path": "strace_logs/"
      }
      }]' "$file"
      upload_step_added=true
    fi
  done
done

echo -e "\n🎉 Done! All workflows updated with strace instrumentation."