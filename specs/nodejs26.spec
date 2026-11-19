Name:           nodejs26
Version:        %{node_version}
Release:        1%{?dist}
Summary:        Node.js 26 JavaScript runtime
License:        MIT AND Apache-2.0 AND BSD-3-Clause
URL:            https://nodejs.org/
Source0:        node-v%{version}-linux-x64.tar.xz
BuildArch:      x86_64
Provides:       nodejs26 = %{version}-%{release}
%global debug_package %{nil}
%global __os_install_post %{nil}

%description
Node.js 26 runtime and npm from the official precompiled Linux x64 release.

%prep
%setup -q -n node-v%{version}-linux-x64

%build
# The RPM repackages official precompiled binaries. It does not compile Node.js.

%install
install -d "%{buildroot}/opt/nodejs/26/%{version}"
cp -a . "%{buildroot}/opt/nodejs/26/%{version}/"
ln -s "%{version}" "%{buildroot}/opt/nodejs/26/current"
install -d "%{buildroot}%{_bindir}"
ln -s /opt/nodejs/26/current/bin/node "%{buildroot}%{_bindir}/node26"
cat > "%{buildroot}%{_bindir}/npm26" <<'EOF'
#!/bin/sh
PATH=/opt/nodejs/26/current/bin:$PATH
export PATH
exec /opt/nodejs/26/current/bin/node /opt/nodejs/26/current/lib/node_modules/npm/bin/npm-cli.js "$@"
EOF
cat > "%{buildroot}%{_bindir}/npx26" <<'EOF'
#!/bin/sh
PATH=/opt/nodejs/26/current/bin:$PATH
export PATH
exec /opt/nodejs/26/current/bin/node /opt/nodejs/26/current/lib/node_modules/npm/bin/npx-cli.js "$@"
EOF
chmod 0755 "%{buildroot}%{_bindir}/npm26" "%{buildroot}%{_bindir}/npx26"

%check
test "$(./bin/node --version)" = "v%{version}"
./bin/node ./bin/npm --version

%files
%dir /opt/nodejs/26
/opt/nodejs/26/current
/opt/nodejs/26/%{version}
%{_bindir}/node26
%{_bindir}/npm26
%{_bindir}/npx26

%changelog
* Thu Nov 19 2026 Eliware <eliware@eliware.org> - %{version}-1
- Repackage the official Node.js 26 Linux x64 binaries.
