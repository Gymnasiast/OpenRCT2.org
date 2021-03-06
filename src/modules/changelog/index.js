import RPN from 'request-promise-native';
import log from '../../utils/log';
import Paths from '../../utils/paths';
import Path from 'path';
import JSONFile from 'jsonfile';
import FS from 'fs';

export default class Changelog {
    /**
     * Fetch url
     * @returns {void}
     */
    static async fetch() {
        //Schedule next fetch
        setTimeout(this.fetch.bind(this), 3600 * 1000);

        let saved;
        try {
            const rawContent = await this.file;
            const content = this.parse(rawContent);
            saved = await this.save(this.fileName, content);
        } catch (error) {
            log.error(error);
            return;
        }

        log.debug(saved ? 'Saved new changelog data' : 'Parsed latest changelog data but didn\'t save');
    }

    /**
     * Get file
     * @returns {Promise<string>}
     */
    static get file() {
        return new Promise(async (resolve, reject) => {
            const options = {
                uri: 'https://raw.githubusercontent.com/OpenRCT2/OpenRCT2/develop/distribution/changelog.txt',
                qs: {}
            };

            let results;
            try {
                results = await RPN(options);
            } catch (error) {
                reject(error);
                return;
            }

            resolve(results);
        });
    }

    /**
     *
     * @param {string} rawContentStr
     */
    static parse(rawContentStr) {
        const rawContent = rawContentStr.split('\n');

        //Filter versions
        const changelog = [];

        let processingChangeset;

        rawContent.forEach((str, index) => {
            if (!str.startsWith('------')) {
                if (!processingChangeset)
                    return;

                //Skip malformed changes
                str = str.trim();
                if (!str || !str.startsWith('- '))
                    return;

                //Push change
                processingChangeset.changes.push(str.substring(2));

                return;
            }

            const versionName = rawContent[index - 1];
            if (!versionName)
                return;

            const changeset = processingChangeset = {
                versionName,
                changes: []
            };
            changelog.push(changeset);
        });

        return changelog;
    }

    /**
     * Writes file if content is new
     * @param {string} file
     * @param {object} content
     * @returns {Promise<boolean>}
     */
    static save(file, content) {
        return new Promise((resolve, reject) => {
            //Check if we already have the same content stored
            JSONFile.readFile(file, (error, readContent) => {
                if (!error && JSON.stringify(content) === JSON.stringify(readContent)) {
                    resolve(false);
                    return;
                }

                //Write new file
                JSONFile.writeFile(file, content, error => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    this.#cachedContent = content;
                    this.#cachedModifiedDate = new Date();

                    resolve(true);
                });
            });
        });
    }

    /**
     * Get file name
     * @returns {string}
     */
    static get fileName() {
        return Path.join(Paths.data, 'changelog.json');
    }

    /**
     * @type {object}
     */
    static #cachedContent;

    /**
     * Get content
     * @returns {Promise<object>}
     */
    static get content() {
        return new Promise((resolve, reject) => {
            if (this.#cachedContent) {
                resolve(this.#cachedContent);
                return;
            }

            JSONFile.readFile(this.fileName, (error, changelog) => {
                if (error) {
                    reject(error);
                    return;
                }

                this.#cachedContent = changelog;
                resolve(changelog);
            });
        });
    }

    /**
     * @type {Date}
     */
    static #cachedModifiedDate;

    /**
     * Get modified date
     * @returns {Promise<Date>}
     */
    static get modifiedDate() {
        return new Promise(async (resolve, reject) => {
            if (this.#cachedModifiedDate) {
                resolve(this.#cachedModifiedDate);
                return;
            }

            FS.stat(this.fileName, (error, stats) => {
                if (error) {
                    reject(error);
                    return;
                }

                const modifiedDate = this.#cachedModifiedDate = stats.mtime || stats.ctime || stats.birthtime;
                resolve(modifiedDate);
            });
        });
    }
}

Changelog.fetch();