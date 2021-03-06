import { Injectable } from '@angular/core';
import { ElectronService } from '../electron/electron.service';
import { Process, ProcessType } from '../../model/process';
import { App } from '../../model/app.model';
import { FlatpakProcess } from './flatpak-process';
import { EventBusService } from 'ngx-eventbus';
import { SnapProcess } from './snap-process';
import { AppImageProcess } from './appimage-process';
import { GithubRepository } from '../../repository/github/github.repository';

@Injectable({
    providedIn: "root"
})
export class ProcessService {

    processQueue: Process[] = []
    processQueueErrors: Process[] = []
    processServiceState = ProcessServiceState.IDLE


    constructor(
        private electronService: ElectronService,
        private eventBusService: EventBusService,
        private githubRepository: GithubRepository
    ) { }

    install(app: App) {
        if (!this.electronService.isElectron) return

        switch (app.type) {
            case 'Flatpak':
                this.addFlatpakProcessToQueue(app, ProcessType.INSTALL)
                break
            case 'Snap':
                this.addSnapProcessToQueue(app, ProcessType.INSTALL)
                break
            case 'AppImage':
                this.addAppImageProcessToQueue(app, ProcessType.INSTALL)
                break
            default:
                console.log(`This app cannot install ${app.type} yet`)
        }

        if (this.processServiceState == ProcessServiceState.IDLE) {
            this.onQueueModified()
        }
    }

    private onQueueModified() {
        if (this.processQueue.length > 0) {
            this.processServiceState = ProcessServiceState.BUSY
            this.processQueue[0].start()
        } else {
            this.processServiceState = ProcessServiceState.IDLE
            console.log('Empty queue')
        }
    }

    addSnapProcessToQueue(app: App, processType: ProcessType) {
        const process = new SnapProcess(
            this.onProcessFinished.bind(this),
            this.onProcessUpdated.bind(this),
            app,
            processType,
            this.electronService
        )
        this.processQueue.push(process)
    }

    addAppImageProcessToQueue(app: App, processType: ProcessType) {
        const process = new AppImageProcess(
            this.onProcessFinished.bind(this),
            this.onProcessUpdated.bind(this),
            app,
            processType,
            this.electronService,
            this.githubRepository
        )
        this.processQueue.push(process)
    }

    addFlatpakProcessToQueue(app: App, processType: ProcessType) {
        const process = new FlatpakProcess(
            this.onProcessFinished.bind(this),
            this.onProcessUpdated.bind(this),
            app,
            processType,
            this.electronService
        )
        this.processQueue.push(process)
    }

    onProcessFinished(app: App, success: boolean, exitCode: number) {
        const finishedProccess = this.processQueue.shift()
        if (!success) {
            this.processQueueErrors.push(finishedProccess)
        }
        this.onQueueModified()
        this.eventBusService.triggerEvent(app._id, { app, success, exitCode })
    }

    onProcessUpdated(app: App, text: String) {
        this.eventBusService.triggerEvent(`info-${app._id}`, text)
    }

    uninstall(app: App) {
        if (!this.electronService.isElectron) return

        switch (app.type) {
            case 'Flatpak':
                this.addFlatpakProcessToQueue(app, ProcessType.REMOVE)
                break
            case 'Snap':
                this.addSnapProcessToQueue(app, ProcessType.REMOVE)
                break
            case 'AppImage':
                this.addAppImageProcessToQueue(app, ProcessType.REMOVE)
                break
            default:
                console.log(`This app cannot install ${app.type} yet`)
        }

        if (this.processServiceState == ProcessServiceState.IDLE) {
            this.onQueueModified()
        }
    }
}

enum ProcessServiceState {
    BUSY,
    IDLE
}
