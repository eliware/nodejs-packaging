FROM quay.io/centos/centos:stream10

ARG NODE_VERSION
ARG SOURCE_SHA256
ARG BASE_IMAGE_DIGEST
ARG NODEJS_REPOSITORY_URL
ARG REPOSITORY_GENERATION

LABEL org.opencontainers.image.title="CentOS Stream 10 Node.js 26 base"
LABEL org.opencontainers.image.version="${NODE_VERSION}"
LABEL org.opencontainers.image.source="https://github.com/eliware/nodejs-packaging"
LABEL org.eliware.nodejs.source-sha256="${SOURCE_SHA256}"
LABEL org.eliware.base-image.digest="${BASE_IMAGE_DIGEST}"
LABEL org.eliware.nodejs.repository-generation="${REPOSITORY_GENERATION}"

RUN test -n "$NODEJS_REPOSITORY_URL" \
    && printf '[nodejs26]\nname=Eliware Node.js 26\nbaseurl=%s/el10/x86_64/stable/\nenabled=1\ngpgcheck=1\nrepo_gpgcheck=1\ngpgkey=%s/keys/RPM-GPG-KEY-ELIWARE-NODEJS\n' "$NODEJS_REPOSITORY_URL" "$NODEJS_REPOSITORY_URL" > /etc/yum.repos.d/nodejs26.repo \
    && dnf install -y eliware-nodejs26 \
    && dnf clean all \
    && useradd --uid 10001 --create-home node

ENV NPM_CONFIG_PREFIX="/var/lib/eliware/nodejs26/global"
ENV PATH="/var/lib/eliware/nodejs26/global/bin:/usr/local/bin:/usr/bin:/opt/nodejs/26/current/bin:${PATH}"

USER 10001
WORKDIR /home/node
CMD ["node"]
